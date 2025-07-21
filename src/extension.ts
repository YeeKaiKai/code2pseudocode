// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { codeToPseudocode } from './claudeApi';
import * as dotenv from 'dotenv';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	// 載入 .env 文件 - 使用 extension 根目錄的路徑
	const extensionPath = context.extensionPath;
	dotenv.config({ path: path.join(extensionPath, '.env') });

	console.log('Code2Pseudocode extension is now active!');
	console.log('Extension path:', extensionPath);
	console.log('CLAUDE_API_KEY exists:', !!process.env.CLAUDE_API_KEY);

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
		const apiKey = process.env.CLAUDE_API_KEY;

		if (!apiKey) {
			vscode.window.showErrorMessage('找不到 CLAUDE_API_KEY，請檢查 .env 檔案');
			return;
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
				const pseudocode = await codeToPseudocode(selectedText);

				progress.report({ increment: 70, message: "正在顯示結果..." });

				// 創建分割視窗顯示結果
				await showPseudocodePanel(pseudocode);

			} catch (error) {
				console.error('轉換失敗:', error);
				vscode.window.showErrorMessage(`轉換失敗: ${(error as Error).message}`);
			}
		});
	});

	context.subscriptions.push(disposable);
}

/**
 * 創建分割視窗顯示 pseudocode
 */
async function showPseudocodePanel(pseudocode: string) {
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
	panel.webview.html = getWebviewContent(pseudocode);
}

/**
 * 生成 WebView 的 HTML 內容
 */
function getWebviewContent(pseudocode: string): string {
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
                height: 100vh;
                display: flex;
                flex-direction: column;
            }
            .container h2 {
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
            .pseudocode {
                background-color: var(--vscode-diffEditor-removedTextBackground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🔄 Pseudocode</h2>
            <div class="code-block pseudocode">${escapeHtml(pseudocode)}</div>
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
