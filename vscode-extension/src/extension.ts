import * as vscode from 'vscode';
import { PlenoviewSessionManager } from './sessionManager';
import type { DesktopCommandId } from './protocol';

const VIEW_TYPE = 'plenoview.exrViewer';

class PlenoviewDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}

  dispose(): void {}
}

class PlenoviewEditorProvider implements vscode.CustomReadonlyEditorProvider<PlenoviewDocument> {
  constructor(private readonly manager: PlenoviewSessionManager) {}

  async openCustomDocument(uri: vscode.Uri): Promise<PlenoviewDocument> {
    return new PlenoviewDocument(uri);
  }

  async resolveCustomEditor(
    document: PlenoviewDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    await this.manager.createCustomEditorSession(webviewPanel, document.uri);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const manager = new PlenoviewSessionManager(context);

  context.subscriptions.push(vscode.window.registerCustomEditorProvider(
    VIEW_TYPE,
    new PlenoviewEditorProvider(manager),
    {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  ));

  context.subscriptions.push(
    vscode.commands.registerCommand('plenoview.openFile', (uri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
      void manager.openFileCommand(uri, selectedUris);
    }),
    vscode.commands.registerCommand('plenoview.openFolder', (uri?: vscode.Uri) => {
      void manager.openFolderCommand(uri);
    }),
    registerDesktopCommand('plenoview.exportImage', 'exportImage', manager),
    registerDesktopCommand('plenoview.exportScreenshot', 'exportScreenshot', manager),
    registerDesktopCommand('plenoview.exportBatch', 'exportBatch', manager),
    registerDesktopCommand('plenoview.exportColormap', 'exportColormap', manager),
    registerDesktopCommand('plenoview.reloadAll', 'reloadAll', manager),
    registerDesktopCommand('plenoview.closeAll', 'closeAll', manager),
    registerDesktopCommand('plenoview.showMetadata', 'metadata', manager),
    registerDesktopCommand('plenoview.openSettings', 'settings', manager),
    registerDesktopCommand('plenoview.viewImage', 'viewerModeImage', manager),
    registerDesktopCommand('plenoview.viewPanorama', 'viewerModePanorama', manager),
    registerDesktopCommand('plenoview.view3d', 'viewerMode3d', manager),
    registerDesktopCommand('plenoview.toggleRulers', 'toggleRulers', manager),
    registerDesktopCommand('plenoview.splitVertical', 'paneSplitVertical', manager),
    registerDesktopCommand('plenoview.splitHorizontal', 'paneSplitHorizontal', manager),
    registerDesktopCommand('plenoview.resetPanes', 'paneReset', manager)
  );
}

export function deactivate(): void {}

function registerDesktopCommand(
  vscodeCommandId: string,
  desktopCommandId: DesktopCommandId,
  manager: PlenoviewSessionManager
): vscode.Disposable {
  return vscode.commands.registerCommand(vscodeCommandId, () => {
    manager.postDesktopCommand(desktopCommandId);
  });
}
