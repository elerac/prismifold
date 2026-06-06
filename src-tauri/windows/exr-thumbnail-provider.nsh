!define PLENOVIEW_EXR_THUMBNAIL_PROVIDER_CLSID "{5A8746CB-B2D1-46C9-AD52-F5DF15DA71D9}"
!define PLENOVIEW_THUMBNAIL_PROVIDER_HANDLER "{e357fccd-a995-4576-b01f-234630154e96}"
!define PLENOVIEW_EXR_PROGID "Plenoview.OpenEXR"
!define PLENOVIEW_EXR_FILE_TYPE_NAME "OpenEXR Image"
!define PLENOVIEW_EXR_CAPABILITIES_PATH "Software\Plenoview\Capabilities"
!define PLENOVIEW_EXR_GENERIC_IMAGE_ICON "%SystemRoot%\System32\imageres.dll,-72"

!macro PLENOVIEW_EXR_THUMBNAIL_SET_REGVIEW
  !if "${ARCH}" == "x64"
    SetRegView 64
  !endif
  !if "${ARCH}" == "arm64"
    SetRegView 64
  !endif
!macroend

!macro PLENOVIEW_EXR_THUMBNAIL_NOTIFY_SHELL
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend

!macro PLENOVIEW_EXR_THUMBNAIL_REMOVE_OLD_ASSOCIATION_IF_DEFAULT FILECLASS
  ReadRegStr $R0 SHCTX "Software\Classes\.exr" ""
  ${If} $R0 == "${FILECLASS}"
    DeleteRegValue SHCTX "Software\Classes\.exr" ""
    DeleteRegKey SHCTX "Software\Classes\${FILECLASS}"
  ${EndIf}
!macroend

!macro PLENOVIEW_EXR_REGISTER_APP_HANDLER
  WriteRegStr SHCTX "Software\Classes\.exr\OpenWithProgids" "${PLENOVIEW_EXR_PROGID}" ""
  WriteRegStr SHCTX "Software\Classes\.exr" "PerceivedType" "image"
  WriteRegStr SHCTX "Software\Classes\.exr" "TypeOverlay" ""
  WriteRegStr SHCTX "Software\Classes\.exr\DefaultIcon" "" "${PLENOVIEW_EXR_GENERIC_IMAGE_ICON}"
  WriteRegStr SHCTX "Software\Classes\${PLENOVIEW_EXR_PROGID}" "" "${PLENOVIEW_EXR_FILE_TYPE_NAME}"
  WriteRegStr SHCTX "Software\Classes\${PLENOVIEW_EXR_PROGID}\DefaultIcon" "" "${PLENOVIEW_EXR_GENERIC_IMAGE_ICON}"
  WriteRegDWORD SHCTX "Software\Classes\${PLENOVIEW_EXR_PROGID}" "Treatment" 0x00000002
  WriteRegStr SHCTX "Software\Classes\${PLENOVIEW_EXR_PROGID}" "TypeOverlay" ""
  WriteRegStr SHCTX "Software\Classes\${PLENOVIEW_EXR_PROGID}\shell" "" "open"
  WriteRegStr SHCTX "Software\Classes\${PLENOVIEW_EXR_PROGID}\shell\open" "" "Open with ${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\${PLENOVIEW_EXR_PROGID}\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""

  WriteRegStr SHCTX "${PLENOVIEW_EXR_CAPABILITIES_PATH}" "ApplicationName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "${PLENOVIEW_EXR_CAPABILITIES_PATH}" "ApplicationDescription" "${PRODUCTNAME} OpenEXR image viewer"
  WriteRegStr SHCTX "${PLENOVIEW_EXR_CAPABILITIES_PATH}\FileAssociations" ".exr" "${PLENOVIEW_EXR_PROGID}"
  WriteRegStr SHCTX "Software\RegisteredApplications" "${PRODUCTNAME}" "${PLENOVIEW_EXR_CAPABILITIES_PATH}"

  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${MAINBINARYNAME}.exe" "Path" "$INSTDIR"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "${PRODUCTNAME}"
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\DefaultIcon"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".exr" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
!macroend

!macro PLENOVIEW_EXR_UNREGISTER_APP_HANDLER
  ReadRegStr $R0 SHCTX "Software\Classes\.exr\DefaultIcon" ""
  ${If} $R0 == "${PLENOVIEW_EXR_GENERIC_IMAGE_ICON}"
    DeleteRegKey SHCTX "Software\Classes\.exr\DefaultIcon"
  ${EndIf}
  DeleteRegValue SHCTX "Software\Classes\.exr\OpenWithProgids" "${PLENOVIEW_EXR_PROGID}"
  DeleteRegValue SHCTX "Software\Classes\.exr" "PerceivedType"
  DeleteRegValue SHCTX "Software\Classes\.exr" "TypeOverlay"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.exr\OpenWithProgids"
  DeleteRegKey SHCTX "Software\Classes\${PLENOVIEW_EXR_PROGID}"
  DeleteRegValue SHCTX "Software\RegisteredApplications" "${PRODUCTNAME}"
  DeleteRegKey SHCTX "${PLENOVIEW_EXR_CAPABILITIES_PATH}"
  DeleteRegKey /ifempty SHCTX "Software\Plenoview"
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro PLENOVIEW_EXR_THUMBNAIL_SET_REGVIEW
  !insertmacro PLENOVIEW_EXR_THUMBNAIL_REMOVE_OLD_ASSOCIATION_IF_DEFAULT "OpenEXR Image"
  !insertmacro PLENOVIEW_EXR_THUMBNAIL_REMOVE_OLD_ASSOCIATION_IF_DEFAULT "Plenoview.exr"
  DeleteRegKey SHCTX "Software\Classes\Plenoview.exr"

  !insertmacro PLENOVIEW_EXR_REGISTER_APP_HANDLER
  WriteRegStr SHCTX "Software\Classes\.exr\ShellEx\${PLENOVIEW_THUMBNAIL_PROVIDER_HANDLER}" "" "${PLENOVIEW_EXR_THUMBNAIL_PROVIDER_CLSID}"
  WriteRegStr SHCTX "Software\Classes\CLSID\${PLENOVIEW_EXR_THUMBNAIL_PROVIDER_CLSID}" "" "Plenoview EXR Thumbnail Provider"
  WriteRegStr SHCTX "Software\Classes\CLSID\${PLENOVIEW_EXR_THUMBNAIL_PROVIDER_CLSID}\InprocServer32" "" "$INSTDIR\plenoview_exr_thumbnail.dll"
  WriteRegStr SHCTX "Software\Classes\CLSID\${PLENOVIEW_EXR_THUMBNAIL_PROVIDER_CLSID}\InprocServer32" "ThreadingModel" "Apartment"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved" "${PLENOVIEW_EXR_THUMBNAIL_PROVIDER_CLSID}" "Plenoview EXR Thumbnail Provider"
  !insertmacro PLENOVIEW_EXR_THUMBNAIL_NOTIFY_SHELL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro PLENOVIEW_EXR_THUMBNAIL_SET_REGVIEW
  !insertmacro PLENOVIEW_EXR_UNREGISTER_APP_HANDLER
  DeleteRegKey SHCTX "Software\Classes\.exr\ShellEx\${PLENOVIEW_THUMBNAIL_PROVIDER_HANDLER}"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.exr\ShellEx"
  DeleteRegKey SHCTX "Software\Classes\CLSID\${PLENOVIEW_EXR_THUMBNAIL_PROVIDER_CLSID}"
  DeleteRegValue SHCTX "Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved" "${PLENOVIEW_EXR_THUMBNAIL_PROVIDER_CLSID}"
  !insertmacro PLENOVIEW_EXR_THUMBNAIL_NOTIFY_SHELL
!macroend
