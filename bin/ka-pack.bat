@echo off
rem Immediately terminate the batch file instead of making the user press Y.
"%~dp0internal\ka-pack.bat" %* < nul
