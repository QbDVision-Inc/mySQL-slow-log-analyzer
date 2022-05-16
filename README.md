MySQL Slow Log Analyzer
=================

This tool can be used to get to the root cause of problems such as:
* Slow queries
* Transaction issues (ex. Deadlock)
* Dropped connections
* Connection Timeout Exceptions under heavy load
* Running out of Memory under load
* Unexpected database reboots (related to memory dropping)

This tool runs on NodeJS and helps you determine why a MySQL database (including an AWS Aurora RDS DB or Aurora RDS Serverless DB) is running slowly, seeing deadlock or running out of memory. Specifically, it converts a MySQL slow query log into a set of CSV files that tell you what's going on under the hood.

## Screenshots

This is what you'll end up with after using this package (columns are [described down below](#column-descriptions)):

![Queries Google Spreadsheet](https://github.com/QbDVision-Inc/MySQLSlowLogAnalyzer/blob/master/images/Screenshot1-Queries.png?raw=true)
![Connections Google Spreadsheet](https://github.com/QbDVision-Inc/MySQLSlowLogAnalyzer/blob/master/images/Screenshot2-Connections.png?raw=true)

## First get a slow query log

To get started, turn on the slow query log in your DB. Here is a video of turning on the slow query log using a clustered AWS Aurora MySQL RDS Database:

![Video showing how to configure the MySQL parameters](https://github.com/QbDVision-Inc/MySQLSlowLogAnalyzer/blob/master/images/Configuring-RDS-MySQL-Slow-Log.gif?raw=true)

After clicking "Save changes" the database will reboot. If you want just the reader/writer to be logged, then follow the same video but click on the DB at the start instead of the cluster. Configuring it at the cluster produces multiple files (one for each reader/writer instance).

The most important setting is setting the `slow_query_log=1` so that you get a slow query log. Setting `long_query_time=0` will get you ALL sql queries, which you probably want. For example, if you want to see only sql queries longer than 5 seconds, then set it to 5.

You can read more about these settings [here](https://dev.mysql.com/doc/refman/5.7/en/slow-query-log.html).

If you want to set these manually, [run these SQL statements](https://stackoverflow.com/a/22609627/491553).

## Create some data in MySQL's slow query log

This is the step that you probably know best. Run some tests, let users do something manual or just wait for a few hours.

## Download the data

If you're using plain old RDS, you can download the slow log file(s) from the RDS console pictured above. If you have multiple log files, you can open them in a text editor (ex. notepad) and cut and paste them all into one big file.

If you're using RDS Serverless, the log files aren't available there and you'll have to get them out of cloudwatch. Look for a log group that looks like `/aws/rds/cluster/<your-DB-Name->/slowquery`. Use the "Log Insights" query engine to query your log group and then download the results (go to `Export Results` -> `Download table (CSV)`). If you have a ton of data (i.e. > 10,000 SQL statements), you'll probably need to extract it by [exporting the Cloudwatch logs to S3](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/S3ExportTasksConsole.html).

If your results are in CSV format, that's fine. Make sure to use the `--cloudwatch-format` option when running the `slowLogAnalyzer.js` program below.


## Download NodeJS and this program

For the rest of this document I'm assuming you're on Windows, but you could be on MacOs or Linux. I recommend Node JS at least 10.16.3 or higher which can be found [here](https://nodejs.org/en/download/). You should now be able to run:
```shell script
C:\> node -v
v10.16.3
``` 

Now clone this repository:
```shell script
cd \temp              (or cd /tmp on Linux)
git clone https://github.com/QbDVision-Inc/MySQLSlowLogAnalyzer.git
cd MySQLSlowLogAnalyzer
npm install
```

Now run
```shell script
node slowLogAnalyzer.js
```

And you should see the help text:
```shell
C:\temp\MySQLSlowLogAnalyzer> node slowLogAnalyzer.js

MySQL Slow Log Analyzer help:


node slowLogAnalyzer.js [--cloudwatch-format] <filename-of-slow-query-log.log>

C:\temp\MySQLSlowLogAnalyzer>
```

## Convert your slow query log

### If it's a .log file
Run the analyzer with your file. Here I'm analyzing `mysql-slowquery.log` which I've copied into the same directory, but it could be in a different place.
```shell script
C:\temp\MySQLSlowLogAnalyzer> node slowLogAnalyzer.js mysql-slowquery.log
Reading mysql-slowquery.log...
Writing timings to query-timings-mysql.csv
Writing connections to connections-mysql.csv

C:\temp\MySQLSlowLogAnalyzer>
```
Two files were created: `query-timings-mysql.csv` and `connections-mysql.csv`.

### If it's a .csv file
If you have a csv file, use the `--cloudwatch-format` flag. Here I'm analyzing `log-insights-results.csv`.
```shell
node slowLogAnalyzer.js --cloudwatch-format log-insights-results.csv
```

Again, the same files (`query-timings-mysql.csv` and `connections-mysql.csv`) should be created.

## Import the query timings into a spreadsheet

In this case, I'll use [Google Sheets](https://sheets.google.com), but Excel should work too.

Steps:
* Create a new spreadsheet 
* Under the `File` menu choose `Import`
* Choose the Upload tab and select the first file, `query-timings-mysql.csv`
  * Use the following options:  
      ![Google Sheets Import File Options](https://github.com/QbDVision-Inc/MySQLSlowLogAnalyzer/blob/master/images/GoogleSheets-ImportFile.png?raw=true)
* Now you have a spreadsheet! Space out the columns so you can read the headers.
* Select the whole spreadsheet and click on `Data -> Create a filter`

### Column Descriptions

Now you can sort by any column you want. Here are what the columns mean:
* **Total Time** - The total time, in seconds, it took for all queries of this type before returning back the data. It is the sum of `Total Query Time` and `Total Lock Time`.
* **Total Query Time** - The total time, in seconds, it took MySQL to figure out the answer to the query.
* **Total Lock Time** - The total time, in seconds, MySQL waited while another transaction had a row/table locked that it needed.
* **Average Time** - The average time, in seconds, for a query (ex. `Total Time / Count`).
* **Count** - The number of times this query was called.
* **Query** - The query being run.  
  * This program will convert queries to being more generic by taking out numbers and strings and converting them to question marks (`?`). 
  * So if you had 10 different queries like `select * from users where id = 3` but the id wasn't always `3`, you'll see them all in one row with the query `select * from users where id = ?`.

## Import the connection count into a spreadsheet

Follow the same instructions for importing the `query-timings-mysql.csv` CSV into the same Google Sheet but this time do it for `connections-mysql.csv` in a new sheet (tab). Import it with these settings:
![Google Sheets Import File Options](https://github.com/QbDVision-Inc/MySQLSlowLogAnalyzer/blob/master/images/GoogleSheets-ImportFile2.png?raw=true)

### Create a chart of connections
__Note: Don't skip this because you're trying to debug a memory problem.__ Read more about why [below](#wait-what-does-the-connection-count-have-to-do-with-running-out-of-memory).

Select the first 2 columns (A and B) of your new `connections-mysql` tab and choose from the menu `Insert -> Chart`. Configure your chart so that the "Connection Count" is on the Y axis and "Time" is on the X-axis, like so:

![Chart configuration](https://github.com/QbDVision-Inc/MySQLSlowLogAnalyzer/blob/master/images/GoogleSheets-Charting.png?raw=true)

You should see a chart like this now:

![A chart of connections](https://github.com/QbDVision-Inc/MySQLSlowLogAnalyzer/blob/master/images/ConnectionsChart.png?raw=true)

If you find your MySQL DB is running out of memory, rebooting often or perhaps throwing "SQL Error 1040: Too Many Connection" errors, this chart will be invaluable. You can see at what time the connection spiked, scroll down to that line and see all of the queries that were running at that time. If you see a steady climb of connections then you're not closing your connections correctly.

## Wait, what does the connection count have to do with running out of memory?

MySQL uses memory in 2 different ways:
1. A general pool for INNODB to cache results to queries, cache indexes and datable data in memory, etc.
    * To see how much memory the overal DB cache is using (in MB): 
       ```
       select (@@key_buffer_size
             + @@query_cache_size
             + @@innodb_buffer_pool_size
             + @@innodb_log_buffer_size
             + @@max_allowed_packet)/(1024*1024);
       ```
1. A per-thread amount to give each thread so they have space to load tables & compute things that aren't already answered in the general pool (#1) above.
Usually in RDS each thread gets around 17.5 MB of memory.  Run the following to see exactly how many MB/connection your DB is configured to use:
   ```
   select (@@read_buffer_size
         + @@read_rnd_buffer_size
         + @@sort_buffer_size
         + @@join_buffer_size
         + @@binlog_cache_size
         + @@net_buffer_length
         + @@net_buffer_length
         + @@thread_stack
         + @@tmp_table_size)/(1024*1024);
   ```
Read more on how to calculate all of the memory things [here](https://dba.stackexchange.com/a/256104/24545).

So each connection uses another 17.5 MB of ram.  If you have 100 connections, that's 1.7GB of RAM being used for those connections.  Look for code causing connection spikes and you'll figure out why your database is rebooting.

## Contributions

Did your data come out looking different? PRs welcome! This won't work for everybody until many folks have tried it and run it.
