// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { codeToPseudocode } from './claudeApi';

export function activate(context: vscode.ExtensionContext) {
	console.log('Code2Pseudocode extension is now active!');

	// 註冊轉換命令
	const disposable = vscode.commands.registerCommand('code2pseudocode.convertToPseudocode', async () => {
		// 獲取當前編輯器和選中的程式碼
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('請先打開一個程式碼文件');
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		if (!selectedText.trim()) {
			vscode.window.showErrorMessage('請先選中要轉換的程式碼');
			return;
		}

		// 獲取 Claude API Key
		let apiKey = vscode.workspace.getConfiguration('code2pseudocode').get<string>('claudeApiKey');

		if (!apiKey) {
			apiKey = await vscode.window.showInputBox({
				prompt: '請輸入 Claude API Key',
				password: true,
				placeHolder: 'sk-ant-...',
				ignoreFocusOut: true
			});

			if (!apiKey) {
				vscode.window.showErrorMessage('需要 Claude API Key 才能轉換程式碼');
				return;
			}

			// 詢問是否要保存 API Key
			const saveKey = await vscode.window.showQuickPick(['是', '否'], {
				placeHolder: '是否要保存此 API Key 到設定中？'
			});

			if (saveKey === '是') {
				await vscode.workspace.getConfiguration('code2pseudocode').update('claudeApiKey', apiKey, vscode.ConfigurationTarget.Global);
			}
		}

		// 顯示進度指示器
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "正在轉換程式碼為 pseudocode...",
			cancellable: false
		}, async (progress) => {
			try {
				progress.report({ increment: 30, message: "正在呼叫 Claude API..." });

				// 呼叫 Claude API
				const pseudocode = await codeToPseudocode(selectedText, apiKey!);

				progress.report({ increment: 70, message: "正在顯示結果..." });

				// 創建分割視窗顯示結果
				await showPseudocodePanel(selectedText, pseudocode);

			} catch (error) {
				console.error('轉換失敗:', error);
				vscode.window.showErrorMessage(`轉換失敗: ${(error as Error).message}`);
			}
		});
	});

	context.subscriptions.push(disposable);
}

/**
 * 創建分割視窗顯示原始程式碼和 pseudocode
 */
async function showPseudocodePanel(originalCode: string, pseudocode: string) {
	// 創建 WebView 面板
	const panel = vscode.window.createWebviewPanel(
		'code2pseudocode',
		'Code to Pseudocode',
		vscode.ViewColumn.Beside, // 在側邊顯示
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	// 設置 WebView 內容
	panel.webview.html = getWebviewContent(originalCode, pseudocode);
}

/**
 * 生成 WebView 的 HTML 內容
 */
function getWebviewContent(originalCode: string, pseudocode: string): string {
	return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code to Pseudocode</title>
        <style>
            body {
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                margin: 0;
                padding: 20px;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }
            .container {
                display: flex;
                gap: 20px;
                height: 100vh;
            }
            .panel {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .panel h2 {
                margin: 0 0 15px 0;
                color: var(--vscode-titleBar-activeForeground);
                border-bottom: 2px solid var(--vscode-titleBar-border);
                padding-bottom: 8px;
            }
            .code-block {
                background-color: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                padding: 15px;
                flex: 1;
                overflow: auto;
                white-space: pre-wrap;
                font-size: 14px;
                line-height: 1.5;
            }
            .original-code {
                background-color: var(--vscode-diffEditor-insertedTextBackground);
            }
            .pseudocode {
                background-color: var(--vscode-diffEditor-removedTextBackground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="panel">
                <h2>📝 原始程式碼</h2>
                <div class="code-block original-code">${escapeHtml(originalCode)}</div>
            </div>
            <div class="panel">
                <h2>🔄 Pseudocode</h2>
                <div class="code-block pseudocode">${escapeHtml(pseudocode)}</div>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * 跳脫 HTML 特殊字符
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export function deactivate() { }
