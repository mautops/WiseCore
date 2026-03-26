; Wisecore Desktop NSIS installer. Run makensis from repo root after
; building dist/win-unpacked (see scripts/pack/build_win.ps1).
; Usage: makensis /DWISECORE_VERSION=1.2.3 /DOUTPUT_EXE=dist\Wisecore-Setup-1.2.3.exe scripts\pack\wisecore_desktop.nsi

!include "MUI2.nsh"
!define MUI_ABORTWARNING
; Use custom icon from unpacked env (copied by build_win.ps1)
!define MUI_ICON "${UNPACKED}\icon.ico"
!define MUI_UNICON "${UNPACKED}\icon.ico"

!ifndef WISECORE_VERSION
  !define WISECORE_VERSION "0.0.0"
!endif
!ifndef OUTPUT_EXE
  !define OUTPUT_EXE "dist\Wisecore-Setup-${WISECORE_VERSION}.exe"
!endif

Name "Wisecore Desktop"
OutFile "${OUTPUT_EXE}"
InstallDir "$LOCALAPPDATA\Wisecore"
InstallDirRegKey HKCU "Software\Wisecore" "InstallPath"
RequestExecutionLevel user

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

; Pass /DUNPACKED=full_path from build_win.ps1 so path works when cwd != repo root
!ifndef UNPACKED
  !define UNPACKED "dist\win-unpacked"
!endif

Section "Wisecore Desktop" SEC01
  SetOutPath "$INSTDIR"
  File /r "${UNPACKED}\*.*"
  WriteRegStr HKCU "Software\Wisecore" "InstallPath" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Main shortcut - uses VBS to hide console window
  CreateShortcut "$SMPROGRAMS\Wisecore Desktop.lnk" "$INSTDIR\Wisecore Desktop.vbs" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$DESKTOP\Wisecore Desktop.lnk" "$INSTDIR\Wisecore Desktop.vbs" "" "$INSTDIR\icon.ico" 0
  
  ; Debug shortcut - shows console window for troubleshooting
  CreateShortcut "$SMPROGRAMS\Wisecore Desktop (Debug).lnk" "$INSTDIR\Wisecore Desktop (Debug).bat" "" "$INSTDIR\icon.ico" 0
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\Wisecore Desktop.lnk"
  Delete "$SMPROGRAMS\Wisecore Desktop (Debug).lnk"
  Delete "$DESKTOP\Wisecore Desktop.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Wisecore"
SectionEnd
