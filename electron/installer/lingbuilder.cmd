@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0LingBuilder.exe" "%~dp0resources\app.asar\dist\cli.cjs" %*

