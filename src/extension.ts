// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { codeToPseudocode } from './claudeApi';
import { PythonCodeBlockParser, CodeBlock, CodeBlockType } from './codeBlockParser';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 全域變數來追踪面板狀態
let pseudocodePanel: vscode.WebviewPanel | undefined;

// 快取管理 - 存儲程式碼區塊與 pseudocode 的對應
const pseudocodeCache = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
	// 載入 .env 文件 - 使用 extension 根目錄的路徑
	const extensionPath = context.extensionPath;
	dotenv.config({ path: path.join(extensionPath, '.env') });

	console.log('Code2Pseudocode extension is now active!');
	console.log('Extension path:', extensionPath);
	console.log('CLAUDE_API_KEY exists:', !!process.env.CLAUDE_API_KEY);

	// 註冊轉換命令
	const disposable = vscode.commands.registerCommand('code2pseudocode.convertToPseudocode', async () => {
		await convertToPseudocode();
	});

	// 註冊檔案儲存事件監聽器
	const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
		// 只有當面板已開啟時才自動轉換
		if (!pseudocodePanel) {
			return;
		}

		// 檢查是否為 Python 檔案
		const fileExtension = document.fileName.toLowerCase();
		const isPythonFile = fileExtension.endsWith('.py');

		if (isPythonFile) {
			// 等待一小段時間確保檔案已完全儲存
			setTimeout(async () => {
				await convertToPseudocode(true); // 傳入 true 表示是自動更新
			}, 100);
		}
	});

	// 註冊檔案變更事件監聽器 - 清理快取
	const onChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
		// 只有在真正有內容變更時才清理快取
		// 檢查是否有實際的內容變更（排除格式化、自動儲存等）
		if (event.contentChanges.length > 0) {
			const hasRealChanges = event.contentChanges.some(change => {
				// 排除純粹的空白字元變更（如自動格式化）
				return change.text.trim() !== '' || change.rangeLength > 0;
			});

			if (hasRealChanges) {
				pseudocodeCache.clear();
			}
		}
	});

	// 註冊 Hover Provider
	const hoverProvider = vscode.languages.registerHoverProvider(
		['python'],
		{
			async provideHover(document, position, token) {
				// 獲取當前行內容，用於初步檢查
				const line = document.lineAt(position.line);
				const lineText = line.text.trim();

				// 只在有程式碼內容的行才顯示（跳過 Python 註解和空行）
				if (!lineText || lineText.startsWith('#')) {
					return null;
				}

				// 檢查 API Key
				const apiKey = process.env.CLAUDE_API_KEY;
				if (!apiKey) {
					const errorMessage = new vscode.MarkdownString();
					errorMessage.appendCodeblock('❌ 找不到 CLAUDE_API_KEY', 'text');
					return new vscode.Hover(errorMessage);
				}

				// 判斷當前行是否為區塊開始行
				const isBlockStartLine = isBlockStart(lineText);

				let codeBlock: CodeBlock;
				let cacheKey: string;

				if (isBlockStartLine) {
					// 如果是區塊開始行，使用區塊識別
					codeBlock = PythonCodeBlockParser.findCodeBlock(document, position);
					cacheKey = codeBlock.code.trim();
				} else {
					// 否則只處理單行
					codeBlock = {
						type: CodeBlockType.SINGLE_LINE,
						startLine: position.line,
						endLine: position.line,
						code: lineText,
						indentLevel: 0
					};
					cacheKey = lineText;
				}

				// 檢查快取
				if (pseudocodeCache.has(cacheKey)) {
					const cachedPseudocode = pseudocodeCache.get(cacheKey)!;

					// 顯示快取結果
					const resultMessage = new vscode.MarkdownString();
					resultMessage.appendCodeblock(`📝 Pseudocode (快取)
${getBlockTypeDisplay(codeBlock.type)} (Lines ${codeBlock.startLine + 1}-${codeBlock.endLine + 1})

${cachedPseudocode}`, 'text');

					return new vscode.Hover(resultMessage);
				}

				try {
					// 呼叫 API 轉換程式碼區塊
					const pseudocode = await codeToPseudocode(codeBlock.code);

					// 存入快取
					pseudocodeCache.set(cacheKey, pseudocode);

					// 顯示結果
					const resultMessage = new vscode.MarkdownString();
					resultMessage.appendCodeblock(`📝 Pseudocode
${getBlockTypeDisplay(codeBlock.type)} (Lines ${codeBlock.startLine + 1}-${codeBlock.endLine + 1})

${pseudocode}`, 'text');

					return new vscode.Hover(resultMessage);

				} catch (error) {
					// 錯誤處理
					const errorMessage = new vscode.MarkdownString();
					errorMessage.appendCodeblock(`❌ 轉換失敗
${getBlockTypeDisplay(codeBlock.type)} (Lines ${codeBlock.startLine + 1}-${codeBlock.endLine + 1})
錯誤: ${(error as Error).message}`, 'text');

					return new vscode.Hover(errorMessage);
				}
			}
		}
	);

	context.subscriptions.push(disposable, onSaveDisposable, onChangeDisposable, hoverProvider);
}

/**
 * 判斷當前行是否為程式碼區塊開始行
 */
function isBlockStart(lineText: string): boolean {
	const trimmed = lineText.trim();

	// 檢查是否以冒號結尾
	if (!trimmed.endsWith(':')) {
		return false;
	}

	// 檢查是否包含區塊關鍵字
	return trimmed.startsWith('def ') ||
		trimmed.startsWith('class ') ||
		trimmed.startsWith('if ') ||
		trimmed.startsWith('elif ') ||
		trimmed === 'else:' ||
		trimmed.startsWith('for ') ||
		trimmed.startsWith('while ') ||
		trimmed === 'try:' ||
		trimmed.startsWith('except') ||
		trimmed === 'finally:' ||
		trimmed.startsWith('with ') ||
		trimmed.startsWith('match ');
}

/**
 * 取得區塊類型的顯示名稱
 */
function getBlockTypeDisplay(type: CodeBlockType): string {
	switch (type) {
		case CodeBlockType.FUNCTION:
			return '🔧 Function';
		case CodeBlockType.CLASS:
			return '🏗️ Class';
		case CodeBlockType.IF:
			return '🔀 If Statement';
		case CodeBlockType.FOR:
			return '🔄 For Loop';
		case CodeBlockType.WHILE:
			return '🔁 While Loop';
		case CodeBlockType.TRY:
			return '🛡️ Try Block';
		case CodeBlockType.SINGLE_LINE:
			return '📝 Single Line';
		default:
			return '📋 Code Block';
	}
}

/**
 * 執行程式碼轉換為 pseudocode 的核心邏輯
 */
async function convertToPseudocode(isAutoUpdate: boolean = false) {
	// 獲取當前編輯器和選中的程式碼
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		if (!isAutoUpdate) {
			vscode.window.showErrorMessage('請先打開一個程式碼文件');
		}
		return;
	}

	const selection = editor.selection;
	let selectedText = editor.document.getText(selection);

	// 如果沒有選中程式碼，則轉換整個檔案
	if (!selectedText.trim()) {
		selectedText = editor.document.getText();
		if (!selectedText.trim()) {
			if (!isAutoUpdate) {
				vscode.window.showErrorMessage('檔案內容為空');
			}
			return;
		}
	}

	// 獲取 Claude API Key
	const apiKey = process.env.CLAUDE_API_KEY;

	if (!apiKey) {
		if (!isAutoUpdate) {
			vscode.window.showErrorMessage('找不到 CLAUDE_API_KEY，請檢查 .env 檔案');
		}
		return;
	}

	// 顯示進度指示器
	const progressLocation = vscode.ProgressLocation.Notification;

	await vscode.window.withProgress({
		location: progressLocation,
		title: isAutoUpdate ? "更新 pseudocode..." : "正在轉換程式碼為 pseudocode...",
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
			if (!isAutoUpdate) {
				vscode.window.showErrorMessage(`轉換失敗: ${(error as Error).message}`);
			}
		}
	});
}

/**
 * 創建分割視窗顯示 pseudocode
 */
async function showPseudocodePanel(pseudocode: string) {
	// 如果面板已存在，只更新內容
	if (pseudocodePanel) {
		pseudocodePanel.webview.html = getWebviewContent(pseudocode);
		return;
	}

	// 創建新的 WebView 面板
	pseudocodePanel = vscode.window.createWebviewPanel(
		'code2pseudocode',
		'Code to Pseudocode',
		vscode.ViewColumn.Beside, // 在側邊顯示
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	// 監聽面板關閉事件
	pseudocodePanel.onDidDispose(() => {
		pseudocodePanel = undefined;
	});

	// 設置 WebView 內容
	pseudocodePanel.webview.html = getWebviewContent(pseudocode);
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
