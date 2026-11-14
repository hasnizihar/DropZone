; ==============================================================================
; DROPZONE - Universal Desktop Download Manager
; Inno Setup 6 Installation Script
; Publisher: Hz Creatives (KR Hasni Zihar)
; License: MIT
; Architecture: Windows 10/11 x64 (Per-User Installation)
; ==============================================================================

#define MyAppName "DROPZONE"
#define MyAppVersion "1.0.0-alpha.12"
#define MyAppPublisher "Hz Creatives"
#define MyAppURL "https://github.com/hasnizihar/dropzone"
#define MyAppExeName "DROPZONE.exe"
#define MyAppId "{8B5985C1-30A8-4D4F-8E4F-29479313A5E2}"
#define MyAppUserModelId "com.dropzone.desktop"

[Setup]
; Unique application identity (enables upgrades & prevents duplicate registry entries)
AppId={{#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
AppCopyright=Copyright (C) 2026 Hz Creatives (KR Hasni Zihar)

; Embedded Windows PE version resources
VersionInfoVersion=1.0.0.12
VersionInfoTextVersion={#MyAppVersion}
VersionInfoProductVersion=1.0.0.12
VersionInfoProductTextVersion={#MyAppVersion}
VersionInfoDescription=DROPZONE Setup
VersionInfoCompany={#MyAppPublisher}
VersionInfoCopyright=Copyright (C) 2026 Hz Creatives (KR Hasni Zihar)
VersionInfoProductName={#MyAppName}

; Per-user installation (no administrator privileges required, avoiding UAC prompts)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
UsedUserAreasWarning=no

; Source and output configuration
OutputDir=..\release
OutputBaseFilename={#MyAppName}-Setup-{#MyAppVersion}-x64
SetupIconFile=assets\installer-icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

; Compression and visual wizard styling
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
WizardImageFile=assets\wizard-large.bmp
WizardSmallImageFile=assets\wizard-small.bmp
DisableWelcomePage=no

; Architecture restriction: 64-bit Windows only
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; Process management: Gracefully close running DROPZONE instances during install/upgrade/uninstall
CloseApplications=yes
CloseApplicationsFilter={#MyAppExeName},dropzone-worker.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Package the full production Electron unpacked application directory
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu shortcut with explicit Windows AppUserModelId for taskbar/notification grouping
Name: "{autoprograms}\{#MyAppName}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; AppUserModelID: "{#MyAppUserModelId}"
; Optional Desktop shortcut
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; AppUserModelID: "{#MyAppUserModelId}"

[Run]
; Launch DROPZONE immediately after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up any leftover temporary updater or log files in the application install directory only.
; CRITICAL SAFETY: User data (%APPDATA%\DROPZONE) and downloads are strictly PRESERVED and NEVER touched.
Type: files; Name: "{app}\*.log"

[Code]
// Pascal script functions for upgrade detection and safety checks

function InitializeSetup(): Boolean;
begin
  Result := True;
  // Inno Setup natively handles AppId matching for upgrades.
  Log('[InnoSetup] Initializing DROPZONE installation. Target version: ' + '{#MyAppVersion}');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    Log('[InnoSetup] DROPZONE installed successfully into: ' + ExpandConstant('{app}'));
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    Log('[InnoSetup] DROPZONE application uninstalled. User databases, settings, and downloads were safely preserved.');
  end;
end;

