"use strict";

const readline = require("readline");
const fs = require("fs");
const moment = require("moment");

const fileToRead = process.argv[2];
const queryTimingsCSVFilename = "query-timings-mysql.csv";
const connectionsCSVFilename = "connections-mysql.csv";


async function main() {
  console.log(`Reading ${fileToRead}...`);

  const readInterface = readline.createInterface({
    input: fs.createReadStream(fileToRead),
    console: false
  });

  let queryToTimingsMap = new Map();

  let currentTiming = {count: 1, query: ""};
  let linesReadSoFar = 0;
  readInterface.on("line", line => {
    linesReadSoFar++;
    if (line.startsWith("# Time:")) {
      // Commit this query to the map
      let query = currentTiming.query;
      if (query) {
        query = cleanUpQuery(query);
        if (queryToTimingsMap.has(query)) {
          let queryTiming = queryToTimingsMap.get(query);
          queryTiming.totalTime += currentTiming.queryTime + currentTiming.lockTime;
          queryTiming.queryTime += currentTiming.queryTime;
          queryTiming.lockTime += currentTiming.lockTime;
          queryTiming.count += 1;
        } else {
          currentTiming.totalTime = currentTiming.queryTime + currentTiming.lockTime;
          currentTiming.query = query;
          queryToTimingsMap.set(query, currentTiming);
        }
      }

      // Reset everything
      currentTiming = {count: 1, query: ""};
    } else if (line.startsWith("# Query_time")) {
      const match = line.match(/# Query_time: ([0-9.]+) +Lock_time: ([0-9.]+) +Rows_sent: ([0-9.]+) +Rows_examined: ([0-9.]+)/);
      currentTiming.queryTime = parseFloat(match[1]);
      currentTiming.lockTime = parseFloat(match[2]);
    } else if (line.startsWith("SET timestamp=")) {
      const match = line.match(/SET timestamp=([0-9]+)/);
      currentTiming.unixTimestamp = parseInt(match[1]);
    } else if (line.startsWith("# User@Host")) {
      const match = line.match(/# User@Host: .* Id: *([0-9]+)/);
      currentTiming.connectionId = parseInt(match[1]);
    } else if (line.startsWith("#")
      || line.startsWith("Tcp port:")
      || line.startsWith("use ")
      || line.startsWith("/* ")
      || line.startsWith("/rdsdbbin")
      || line.startsWith("Time         ")) {
      // Ignore
    } else {
      currentTiming.query += line;
    }
  })
    .on("close", () => {
      writeTimingsCSV(queryToTimingsMap);
      writeConnectionsCSV(queryToTimingsMap);
    });
}

function cleanUpQuery(query) {
  let cleanQuery = query;
  // Convert all numbers to ?
  cleanQuery = cleanQuery.replace(/[-+]?[0-9]*\.?[0-9]+/g, "?");

  // Convert all strings to ?
  cleanQuery = cleanQuery.replace(/'[^']*'/g, "?");
  return cleanQuery;
}

function writeTimingsCSV(queryToTimingsMap) {
  console.log("Writing timings to " + queryTimingsCSVFilename);
  let wstream = fs.createWriteStream(queryTimingsCSVFilename, {encoding: "utf8"});
  wstream.write(`"Total Time","Total Query Time","Total Lock Time","Count","Query"\n`);

  // Arrange the data
  const values = queryToTimingsMap.values();
  const sortedByTime = Array.from(values).sort((v1, v2) => v2.totalTime - v1.totalTime);

  // Write to the CSV file
  for (const timing of sortedByTime) {
    wstream.write(`${timing.totalTime},${timing.queryTime},${timing.lockTime},${timing.count},"${timing.query}"\n`);
  }
  wstream.end();
}

function writeConnectionsCSV(queryToTimingsMap) {
  console.log("Writing connections to " + connectionsCSVFilename);
  let wstream = fs.createWriteStream(connectionsCSVFilename, {encoding: "utf8"});

  // Arrange the data
  let values = queryToTimingsMap.values();
  values = Array.from(values);
  const timestampToQueriesMap = new Map();
  for (const value of values) {
    if (timestampToQueriesMap.has(value.unixTimestamp)) {
      const queries = timestampToQueriesMap.get(value.unixTimestamp);
      queries.push(value.query);
    } else {
      timestampToQueriesMap.set(value.unixTimestamp, [value.query]);
    }
  }
  const timings = Array.from(timestampToQueriesMap.keys()).map(timestamp => {
    let queries = timestampToQueriesMap.get(timestamp);
    return {
      unixTimestamp: timestamp,
      count: queries.length,
      queries: queries,
    };
  });
  const sortedByTime = timings.sort((v1, v2) => v1.unixTimestamp - v2.unixTimestamp);

  // Write to the CSV file
  wstream.write(`"Time","Connection Count","Queries"\n`);
  for (const timing of sortedByTime) {
    wstream.write(`${moment.unix(timing.unixTimestamp).format("YYYY-MM-DD HH:mm:ss")},${timing.count},"${timing.queries.join("\n")}"\n`);
  }
  wstream.end();
}

main();
