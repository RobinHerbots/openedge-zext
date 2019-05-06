import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execCheckSyntax } from './ablCheckSyntax';
import { execRun } from './ablRun';
import { openDataDictionary, readDataDictionary } from './ablDataDictionary';
import { loadOpenEdgeConfig, getConfig } from './ablConfig';
import { loadDictDumpFiles, getTableCollection } from './codeCompletion';
import { execCompile, COMPILE_OPTIONS } from './ablCompile';
import { documentDeploy } from './deploy';
import { ABLFormatter } from './formatter';
import { ABLDocumentController, initDocumentController, getDocumentController } from './documentController';
import { OutlineNavigatorProvider } from './outlineNavigator';
import { ABL_MODE } from './environment';
import { hideStatusBar, initDiagnostic } from './notification';
import { getAllVariables } from './processDocument';
import { isArray } from 'util';
import { KeyBindings } from './keyBindings';

export function activate(ctx: vscode.ExtensionContext): void {
	//const symbolOutlineProvider = new OutlineNavigatorProvider(ctx);


	startBuildOnSaveWatcher(ctx.subscriptions);
	startConfigFileWatcher();
	startDictWatcher();
	startCleanStatusWatcher(ctx.subscriptions);
	startFormatCommand(ctx.subscriptions);
	startDocumentWatcher(ctx);
	initDiagnostic(ctx);
	new KeyBindings(ctx);

	//vscode.workspace.getConfiguration('files').update('encoding', 'iso88591', false);
	//vscode.workspace.getConfiguration('editor').update('tabSize', 4, false);
	/*let config = vscode.workspace.getConfiguration('abl');
	config.update('editor.tabSize', 4, false);
	config.update('editor.insertSpaces', true, false);
	config.update('editor.detectIdentation', false, false);*/
	// Set default workspace
	/*let config = vscode.workspace.getConfiguration('editor');
	config.update('tabSize', 4, false);
	config.update('insertSpaces', true, false);
	config.update('detectIdentation', false, false);*/

	ctx.subscriptions.push(vscode.commands.registerCommand('abl.currentFile.checkSyntax', () => {
		let ablConfig = vscode.workspace.getConfiguration(ABL_MODE.language);
		execCheckSyntax(vscode.window.activeTextEditor.document, ablConfig);
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.currentFile.compile', () => {
		let ablConfig = vscode.workspace.getConfiguration(ABL_MODE.language);
		execCompile(vscode.window.activeTextEditor.document, ablConfig, [COMPILE_OPTIONS.COMPILE]);
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.currentFile.run', () => {
		let ablConfig = vscode.workspace.getConfiguration(ABL_MODE.language);
		execRun(vscode.window.activeTextEditor.document, ablConfig);
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.currentFile.deploySource', () => {
		documentDeploy(vscode.window.activeTextEditor.document);
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.dictionary.dumpDefinition', () => {
		let ablConfig = vscode.workspace.getConfiguration(ABL_MODE.language);
		readDataDictionary(ablConfig);
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.currentFile.compileOptions', () => {
		chooseCompileOption();
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.currentFile.saveMap', (args) => {
		let doc = vscode.window.activeTextEditor.document;
		let filename = null;
		if (args) {
			if ((isArray(args))&&(args.length>0))
				filename = args[0];
			else
				filename = args;
		}
		saveMapFile(doc, filename);
		return filename;
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.currentFile.getMap', () => {
		let doc = vscode.window.activeTextEditor.document;
		if (doc)
			return getDocumentController().getDocument(doc).getMap();
		else
			return {};
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.tables', () => {
		return getTableCollection().items.map(item => item.label);
	}));
	ctx.subscriptions.push(vscode.commands.registerCommand('abl.table', (tableName) => {
		return getTableCollection().items.find(item => item.label == tableName);
	}));

	ctx.subscriptions.push(vscode.commands.registerCommand('abl.compile', (fileName: string) => {
		let ablConfig = vscode.workspace.getConfiguration(ABL_MODE.language);
		return new Promise(function(resolve,reject) {
			vscode.workspace.openTextDocument(fileName).then(doc => {
				execCompile(doc, ablConfig, [COMPILE_OPTIONS.COMPILE], true).then(v => resolve(v));
			});
		})
	}));

	/*ctx.subscriptions.push(vscode.commands.registerCommand('abl.propath', () => {
		vscode.window.showInformationMessage('PROPATH : ' + (getConfig().proPath || ''));
	}));*/
	/*ctx.subscriptions.push(vscode.commands.registerCommand('abl.dataDictionary', () => {
		openDataDictionary();
	}));*/

	/*ctx.subscriptions.push(vscode.commands.registerCommand('abl.prototype', () => {
		getAllVariables(vscode.window.activeTextEditor.document);
	}));*/
}

function deactivate() {
}

function startBuildOnSaveWatcher(subscriptions: vscode.Disposable[]) {
	let ablConfig = vscode.workspace.getConfiguration(ABL_MODE.language);
	if (ablConfig.get('checkSyntaxOnSave') === 'file') {
		vscode.workspace.onDidSaveTextDocument(document => {
			if (document.languageId !== ABL_MODE.language) {
				return;
			}
			execCheckSyntax(document, ablConfig);
		}, null, subscriptions);
	}
}

function startCleanStatusWatcher(subscriptions: vscode.Disposable[]) {
	vscode.window.onDidChangeActiveTextEditor(editor => hideStatusBar());
	/*vscode.workspace.onDidChangeTextDocument(documentEvent => {
		if (documentEvent.document.languageId === ABL_MODE.language) {
			hideStatusBar();
		}
	}, null, subscriptions);*/
}

function startConfigFileWatcher() {
	loadOpenEdgeConfig();
}

function startDictWatcher() {
	loadDictDumpFiles();
}

function startFormatCommand(subscriptions: vscode.Disposable[]) {
	const ablFormatter = new ABLFormatter();
	subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(ABL_MODE.language, ablFormatter));
	//subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(ABL_MODE.language, ablFormatter, '\n', '\r\n'));
}

function startDocumentWatcher(context: vscode.ExtensionContext) {
	initDocumentController(context);
}

function chooseCompileOption() {
	let options = Object.keys(COMPILE_OPTIONS).map(k => {return COMPILE_OPTIONS[k]});
	vscode.window.showQuickPick(options, {placeHolder: 'Compile option', canPickMany: true}).then(v => {
		let ablConfig = vscode.workspace.getConfiguration(ABL_MODE.language);
		execCompile(vscode.window.activeTextEditor.document, ablConfig, v);
	});
}

function saveMapFile(document: vscode.TextDocument, filename?: string) {
	let doc = getDocumentController().getDocument(document);
	if (doc) {
		let save = (fname:string, showMessage:boolean) => {
			let data = doc.getMap();
			if (data) {
				fs.writeFileSync(fname, JSON.stringify(data));
				if (showMessage)
					vscode.window.showInformationMessage('File ' + path.basename(fname) + ' created!');
			}
			else if (showMessage) {
				vscode.window.showErrorMessage('Error mapping file');
			}
		}
		//
		if (filename) {
			save(filename, false);
		}
		else {
			let opt: vscode.InputBoxOptions = {prompt: 'Save into file', value: doc.document.uri.fsPath + '.oe-map.json'};
			vscode.window.showInputBox(opt).then(fname => { if(fname) save(fname, true) });
		}
	}
}