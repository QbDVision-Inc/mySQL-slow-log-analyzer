MySQL Slow Log Analyzer
=================

This tool helps you determine why a MySQL database is running slowly.  Specifically, it converts a MySQL slow query log into a set of CSV files that can be used to figure out why a database is underperforming.  



## First get a slow query log

To get started, turn on the slow query log in your DB.  Here is a video of turning on the slow query log using a clustered AWS Aurora MySQL RDS Database:

![Video showing how to configure the MySQL parameters](https://github.com/CherryCircle/MySQLSlowLogAnalyzer/blob/master/images/Configuring-RDS-MySQL-Slow-Log.gif?raw=true)

After clicking "Save changes" the database will reboot. If you want just the read/writer to be logged, then follow the same video but click on the DB at the start instead of the cluster.

The most important setting is setting the `slow_query_log=1` so that you get a slow query log.  Setting `long_query_time=0` will get you ALL sql queries, which you probably want.  If you want to see only sql queries longer than 5 seconds, then you can set it to 5.

You can read more about these settings [here](https://dev.mysql.com/doc/refman/5.7/en/slow-query-log.html).

If you want to set these manually, [run these SQL statements](https://stackoverflow.com/a/22609627/491553).

## Get some data

This is the easiest step.  Run some tests, let users do something manual or just wait for a few hours.




