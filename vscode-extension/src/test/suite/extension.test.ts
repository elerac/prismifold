import assert from 'node:assert';
import path from 'node:path';
import * as vscode from 'vscode';

suite('Plenoview extension', () => {
  test('registers Plenoview commands', async () => {
    const extension = vscode.extensions.getExtension('elerac.plenoview-vscode');
    assert.ok(extension);
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('plenoview.openFile'));
    assert.ok(commands.includes('plenoview.openFolder'));
    assert.ok(commands.includes('plenoview.exportImage'));
  });

  test('opens an EXR with the custom editor', async () => {
    const fixture = vscode.Uri.file(path.resolve(__dirname, '..', '..', '..', '..', 'public', 'cbox_rgb.exr'));

    await vscode.commands.executeCommand('vscode.openWith', fixture, 'plenoview.exrViewer');
    await waitFor(() => {
      const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
      return tab?.input instanceof vscode.TabInputCustom &&
        tab.input.viewType === 'plenoview.exrViewer' &&
        tab.input.uri.toString() === fixture.toString();
    });

    await vscode.commands.executeCommand('plenoview.viewImage');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for VS Code condition.');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
