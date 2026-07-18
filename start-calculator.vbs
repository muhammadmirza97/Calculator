Option Explicit

Dim fileSystem, shell, projectDirectory, launcherPath, command
Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

projectDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
launcherPath = fileSystem.BuildPath(projectDirectory, "launcher.py")
command = "pyw.exe -3 """ & launcherPath & """"

shell.Run command, 0, False
