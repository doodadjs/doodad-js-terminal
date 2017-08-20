//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2015-2017 Claude Petit, licensed under Apache License version 2.0\n", true)
// doodad-js - Object-oriented programming framework
// File: NodeJs_Terminal.js - NodeJs Terminal
// Project home: https://github.com/doodadjs/
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2015-2017 Claude Petit
//
//	Licensed under the Apache License, Version 2.0 (the "License");
//	you may not use this file except in compliance with the License.
//	You may obtain a copy of the License at
//
//		http://www.apache.org/licenses/LICENSE-2.0
//
//	Unless required by applicable law or agreed to in writing, software
//	distributed under the License is distributed on an "AS IS" BASIS,
//	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//	See the License for the specific language governing permissions and
//	limitations under the License.
//! END_REPLACE()

module.exports = {
	add: function add(DD_MODULES) {
		DD_MODULES = (DD_MODULES || {});
		DD_MODULES['Doodad.NodeJs.Terminal'] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
			namespaces: ['Ansi'],
			
			create: function create(root, /*optional*/_options, _shared) {
				"use strict";

				// TODO: Fix Unicode cursor movements
				
				const doodad = root.Doodad,
					types = doodad.Types,
					tools = doodad.Tools,
					unicode = tools.Unicode,
					files = tools.Files,
					safeEval = tools.SafeEval,
					namespaces = doodad.Namespaces,
					modules = doodad.Modules,
					config = tools.Config,
					extenders = doodad.Extenders,
					interfaces = doodad.Interfaces,
					mixIns = doodad.MixIns,
					io = doodad.IO,
					ioInterfaces = io.Interfaces,
					ioMixIns = io.MixIns,
					server = doodad.Server,
					nodejs = doodad.NodeJs,
					nodejsIO = nodejs.IO,
					nodejsTerminal = nodejs.Terminal,
					nodejsTerminalAnsi = nodejsTerminal.Ansi,
				
					nodeUtil = require('util');
				
				
				const __Internal__ = {
					oldStdIn: null,
					oldStdOut: null,
					oldStdErr: null,
					osType: tools.getOS().type,

					Settings: types.nullObject(),
				};
				
				types.complete(_shared.Natives, {
					mathFloor: global.Math.floor,
					mathMin: global.Math.min,
					mathMax: global.Math.max,
					mathAbs: global.Math.abs,
					mathSign: global.Math.sign,
				});
				
				nodejsTerminalAnsi.ADD('computeKeyboard', function computeKeyboard(keyboard) {
					const computed = {};
					tools.forEach(keyboard, function(sequence, name) {
						if (name === '//') {
							return;
						};
						const len = sequence.length;
						let regExp = '';
						for (let i = 0; i < len; i++) {
							let chr = sequence[i],
								optional = false,
								more = false,
								or = false,
								exclude = null;
							if (types.isObject(chr)) {
								optional = types.get(chr, 'optional', optional);
								more = types.get(chr, 'more', more);
								or = types.get(chr, 'or', or);
								exclude = types.get(chr, 'exclude', exclude);
								chr = types.get(chr, 'chr', null);
							};
							if (or) {
								regExp += '|';
							};
							if (exclude) {
								if (!types.isArray(exclude)) {
									exclude = [exclude];
								};
								const excludeLen = exclude.length;
								if (excludeLen) {
									regExp += '[^';
									for (let j = 0; j < excludeLen; j++) {
										let chr = exclude[j];
										if (types.isString(chr)) {
											chr = chr.split('-');
											regExp += tools.escapeRegExp(String.fromCharCode(types.toInteger(chr[0]))) + '-' + tools.escapeRegExp(String.fromCharCode(types.toInteger(chr[1])));
										} else if (types.isInteger(chr)) {
											regExp += tools.escapeRegExp(String.fromCharCode(chr));
										};
									};
									regExp += ']';
								};
							} else if (types.isString(chr)) {
								chr = chr.split('-');
								regExp += '[' + tools.escapeRegExp(String.fromCharCode(types.toInteger(chr[0]))) + '-' + tools.escapeRegExp(String.fromCharCode(types.toInteger(chr[1]))) + ']';
							} else if (types.isInteger(chr)) {
								chr = String.fromCharCode(chr);
								regExp += '[' + tools.escapeRegExp(chr) + ']';
							} else {
								regExp += '.';
							};
							if (optional) {
								if (more) {
									regExp += '*';
								} else {
									regExp += '?';
								};
							} else if (more) {
								regExp += '+';
							};
						};
						computed[name] = new RegExp('^' + regExp, 'g');
					}, {});
					return computed;
				});
				
				nodejsTerminalAnsi.ADD('parseKeys', function parseKeys(ansi, /*optional*/pos, /*optional*/maxKeysCount) {
					ansi = types.toString(ansi).replace(/(\r\n)|(\n\r)|\r|\n/gm, __Internal__.Settings.EnterKey);
					
					pos = (pos || 0);
					maxKeysCount = (maxKeysCount || Infinity);
					
					const keys = [];

					const keyboard = __Internal__.Settings.Keyboard;
					const entries = types.keys(keyboard);

					while ((pos < ansi.length) && (keys.length < maxKeysCount)) {
						const key = {};
						
						let size = 1;
						let found = false;
						scanKeyboard: for (let k = 0; k < entries.length; k++) {
							let name = entries[k];
							
							const regEx = keyboard[name];
							regEx.lastIndex = 0;
							const match = regEx.exec(ansi.slice(pos));
							if (match) {
								size = match[0].length;
								name = name.split('_');
								const nameLen = name.length;
								let count = 0;
								for (let i = 0; i < nameLen; i++) {
									const keyName = name[i];
									if (keyName) {
										if (keyName.length > 1) {
											if (keyName === 'Ctrl') {
												key.functionKeys |= io.KeyboardFunctionKeys.Ctrl;
											} else if (keyName === 'Alt') {
												key.functionKeys |= io.KeyboardFunctionKeys.Alt;
											} else if (keyName === 'Shift') {
												key.functionKeys |= io.KeyboardFunctionKeys.Shift;
											} else {
												key.text = null;
												key.scanCode = types.get(io.KeyboardScanCodes, keyName, 0);
											};
										} else {
											key.text = keyName;
											key.scanCode = keyName.charCodeAt(0);
										};
										count++;
									};
								};
								if ((key.functionKeys & io.KeyboardFunctionKeys.Alt) && (count === 1)) {
									let nextKey = nodejsTerminalAnsi.parseKeys(ansi, pos + size, 1);
									if (nextKey.length) {
										nextKey = nextKey[0];
										size += nextKey.ansi.length;
									} else {
										continue scanKeyboard;
									};
								};
								found = true;
								break;
							};
						};
						if (!found) {
							const cp = unicode.codePointAt(ansi, pos);
							if (cp) {
								size = cp.size;
								key.charCode = cp.codePoint;
								if (cp.codePoint === 0x1B) { // ESC
									key.text = null;
									key.scanCode = io.KeyboardScanCodes.Escape;
								} else {
									key.text = ansi.slice(pos, pos + size);
								};
							};
						};
						
						key.ansi = ansi.slice(pos, pos + size);
						
						keys.push(key);
						
						pos += size;
					};
					
					return keys;
				});

				nodejsTerminalAnsi.ADD('toText', function toText(ansi) {
					ansi = types.toString(ansi);
					ansi = ansi.replace(/(\r\n)|(\n\r)|\r|\n/gm, __Internal__.Settings.NewLine);
					ansi = ansi.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/gm, '');
					return ansi;
				});
				
				nodejsTerminalAnsi.REGISTER(io.Stream.$extend(
									ioMixIns.KeyboardInput,
									ioMixIns.TextOutput,
									ioInterfaces.IConsole,
									mixIns.NodeEvents,
				{
					$TYPE_NAME: 'Terminal',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('Terminal')), true) */,
					
					number: doodad.PUBLIC(doodad.READ_ONLY(null)),
					stdin: doodad.PUBLIC(doodad.READ_ONLY(null)),
					stdout: doodad.PUBLIC(doodad.READ_ONLY(null)),
					stderr: doodad.PUBLIC(doodad.READ_ONLY(null)),
					
					__interrogate: doodad.PROTECTED(false),
					__interrogateTimeoutId: doodad.PROTECTED(null),
					__interrogateCallback: doodad.PROTECTED(null),

					__column: doodad.PROTECTED(0),
					__row: doodad.PROTECTED(0),
					__columns: doodad.PROTECTED(0),
					
					__savedColumn: doodad.PROTECTED(0),
					__savedRow: doodad.PROTECTED(0),
					
					__consoleWritesCount: doodad.PROTECTED(0),
					__consoleWritesIntervalId: doodad.PROTECTED(null),
					
					create: doodad.OVERRIDE(function create(number, /*optional*/options) {
						root.DD_ASSERT && root.DD_ASSERT(types.isInteger(number) && (number >= 0) && (number < 10), "Invalid console number.");
						const attrs = {
							number: number,
							stdin: types.get(options, 'stdin', io.stdin),
							stdout: types.get(options, 'stdout', io.stdout),
							stderr: types.get(options, 'stderr', io.stderr),
						};
						root.DD_ASSERT && root.DD_ASSERT(
								types._instanceof(attrs.stdin, nodejsIO.TextInputStream) && 
								types._instanceof(attrs.stdout, nodejsIO.TextOutputStream) && 
								types._instanceof(attrs.stderr, nodejsIO.TextOutputStream), 
							"Invalid 'stdin', 'stdout' or 'stderr'."
						);
						_shared.setAttributes(this, attrs);

						types.getDefault(options, 'writesLimit', 50);
						
						this._super(options);

						this.onStreamResize.attach(this.stdout.stream);
						this.setColumns();
					}),

					destroy: doodad.OVERRIDE(function destroy() {
						this.stopListening();
						this.onStreamResize.clear();
						if (this.__consoleWritesIntervalId) {
							global.clearTimeout(this.__consoleWritesIntervalId);
							this.__consoleWritesIntervalId = null;
						};
						this._super();
					}),
					
					beforeQuit: doodad.PROTECTED(function quit() {
						this.writeLine();
					}),
					
					__onStdInListen: doodad.PROTECTED(function onStdInListen(ev) {
						function listenInternal() {
							__Internal__.currentTerminal = this;
							__Internal__.oldStdIn = io.stdin;
							__Internal__.oldStdOut = io.stdout;
							__Internal__.oldStdErr = io.stderr;
							io.setStds({
								stdin: this,
								stdout: this,
								stderr: this,
							});
							
							this.onListen(ev);
						};
						
						//const os = tools.getOS();
						//if (os.type === 'windows') {
						//	// <PRB> Windows doesn't not respond.
							tools.callAsync(listenInternal, -1, this);
						//} else {
						//	this.interrogateTerminal(__Internal__.Settings.SimpleCommands.RequestDeviceAttributes, doodad.Callback(this, function(err, response) {
						//		if (err) {
						//			console.warn("Terminal can't be identified.");
						//		} else if (response !== '\u001B[?1;2c') {
						//			console.warn("This program is optimized for a VT100 terminal with Advanced Video Option.");
						//		};
						//		listenInternal.call(this);
						//	}));
						//};
					}),
					
					__onStdInStopListening: doodad.PROTECTED(function(ev) {
						this.stdin.onReady.detach(this, this.__onStdInReady);

						io.setStds({
							stdin: __Internal__.oldStdIn,
							stdout: __Internal__.oldStdOut,
							stderr: __Internal__.oldStdErr,
						});
						__Internal__.oldStdIn = null;
						__Internal__.oldStdOut = null;
						__Internal__.oldStdErr = null;
					}),
							
					__onStdInReady: doodad.PROTECTED(function onStdInReady(ev) {
						ev.preventDefault();

						const ansi = this.transformOut(ev.data);

						if (this.__interrogate) {
							const result = this.__interrogateCallback(null, ansi);
							if (result !== false) { // should returns 'false' if interrogate is not terminated
								this.__interrogate = false;
								this.__interrogateTimeoutId.cancel();
								this.__interrogateTimeoutId = null;
								this.__interrogateCallback = null;
							};
						} else {
							const keys = nodejsTerminalAnsi.parseKeys(ansi),
								len = keys.length;
							
							for (let i = 0; i < len; i++) {
								const key = keys[i];
								if (!types.get(this.options, 'ignoreCtrlC', false) && (key.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (key.text === 'C')) { // CTRL+C
									this.beforeQuit();
									tools.abortScript();
									break;  // <<< should not be executed
								} else {
									this.push(new io.Data(key));
								};
							};
						};
					}),
					
					cancelInterrogate: doodad.PUBLIC(function cancelInterrogate(/*optional*/reason) {
						if (!this.__interrogate) {
							throw new types.NotAvailable();
						};
						this.__interrogate = false;
						this.__interrogateTimeoutId.cancel();
						this.__interrogateTimeoutId = null;
						this.__interrogateCallback(reason || new types.CanceledError());
						this.__interrogateCallback = null;
					}),
					
					interrogateTerminal: doodad.PUBLIC(function interrogateTerminal(requestCommand, callback, /*optional*/timeout) {
						if (this.__interrogate) {
							throw new types.NotAvailable();
						};
						this.__interrogateCallback = callback;
						this.__interrogateTimeoutId = tools.callAsync(this.cancelInterrogate, timeout || 1000, this, [new types.TimeoutError()], true);
						this.write(requestCommand);
						this.__interrogate = true;
					}),
					
					isListening: doodad.REPLACE(function isListening() {
						return !!this.stdin && this.stdin.isListening();
					}),

					listen: doodad.REPLACE(function listen(/*optional*/options) {
						if (!this.isListening()) {
							this.stdin.onListen.attach(this, this.__onStdInListen);
							this.stdin.onStopListening.attach(this, this.__onStdInStopListening);
							this.stdin.onReady.attach(this, this.__onStdInReady);
							this.stdin.listen(options);
						};
					}),

					stopListening: doodad.REPLACE(function stopListening() {
						if (this.isListening()) {
							this.stdin.stopListening();
						};
					}),
					
					saveCursor: doodad.PUBLIC(function saveCursor() {
						this.write(__Internal__.Settings.SimpleCommands.SaveCursor);
						
						this.__savedColumn = this.__column;
						this.__savedRow = this.__row;
					}),

					restoreCursor: doodad.PUBLIC(function restoreCursor() {
						this.__column = _shared.Natives.mathMin(this.__savedColumn, this.__columns);
						this.__row = this.__savedRow;
						
						this.write(__Internal__.Settings.SimpleCommands.RestoreCursor);
					}),

					resetPosition: doodad.PUBLIC(function resetPosition() {
						this.__column = 1;
						this.__row = 1;
					}),
					
					refresh: doodad.PUBLIC(doodad.METHOD()),
					
					reset: doodad.OVERRIDE(function reset() {
						this._super();

						this.resetPosition();

						this.__consoleWritesCount = 0;

						if (this.__consoleWritesIntervalId) {
							global.clearTimeout(this.__consoleWritesIntervalId);
							this.__consoleWritesIntervalId = null;
						};

						let timeoutCb;
						const __timeout = function timeout() {
							this.__consoleWritesIntervalId = global.setTimeout(doodad.Callback(this, function() {
								if (!_shared.DESTROYED(this)) {
									if (this.__consoleWritesCount > 0) {
										this.refresh();
									};
									this.__consoleWritesCount = 0;
									timeoutCb();
								};
							}), 2000);
						};

						timeoutCb = doodad.Callback(this, __timeout);

						__timeout.call(this);
					}),

					clear: doodad.OVERRIDE(function clear() {
						this._super();
						
						this.resetPosition();
					}),

					calculateTextDims: doodad.PROTECTED(function calculateTextDims(text, /*optional*/options) {
						text = nodejsTerminalAnsi.toText(text);
						
						const lines = text.split(__Internal__.Settings.NewLine),
							linesLen = lines.length;
							
						let columns = 0,
							rows = 0;
							
						for (let i = 0; i < linesLen; i++) {
							const line = lines[i],
								lineLen = unicode.charsCount(line);
							if (lineLen) {
								rows += _shared.Natives.mathFloor(lineLen / this.__columns);
								columns = (lineLen % this.__columns);
							};
						};
						
						return {
							rows: rows,
							columns: columns,
						};
					}),

					writeText: doodad.REPLACE(function writeText(text, /*optional*/options) {
						text = nodejsTerminalAnsi.toText(text);

						const dims = this.calculateTextDims(text, options);
						
						this.__row += dims.rows;
						this.__column += dims.columns;
						
						if (this.__column > this.__columns) {
							this.__row += _shared.Natives.mathFloor(this.__column / this.__columns);
							this.__column = (this.__column % this.__columns);
						};
						
						this.write(text, options);
					}),

					canWrite: doodad.REPLACE(function canWrite() {
						return this.stderr.canWrite() && this.stdout.canWrite();
					}),

					__submitInternal: doodad.REPLACE(function __submitInternal(data, /*optional*/options) {
						if (data.raw !== io.EOF) {
							const stream = (types.get(data.options, 'isError') ? this.stderr : this.stdout);
							if (stream.canWrite()) {
								stream.write(data);
							};
						};
						data.consume();
					}),
					
					consoleWrite: doodad.PUBLIC(function consoleWrite(name, args, /*optional*/options) {
						if (!this.canWrite()) {
							// Too much log data, are we in a loop ?
							return;
						};
						if (this.__consoleWritesCount === this.options.writesLimit) {
							name = 'info';
							args = ["... (console writes limit reached)"];
						};
						if (this.__consoleWritesCount <= this.options.writesLimit) {
							const msg = nodeUtil.format.apply(nodeUtil, args)
							
							this.__consoleWritesCount++;
							
							let ansi = '';
							
							ansi +=
								(this.__row > 1 ? tools.format("\u001B[~0~A", [this.__row - 1]) : '') + // CursorUp X times
								__Internal__.Settings.SimpleCommands.EraseLine + 
								__Internal__.Settings.SimpleCommands.EraseBelow + 
								__Internal__.Settings.SimpleCommands.CursorHome;
								
							options = types.extend({}, this.options, options);
							const color = __Internal__.Settings.Colors[types.get(options, name + 'Color', null)];
							if (color) {
								ansi += color[0];
							} else {
								ansi += __Internal__.Settings.Colors.Normal[0];
							};
							const bgColor = __Internal__.Settings.Colors[types.get(options, name + 'BgColor', null)];
							if (bgColor) {
								ansi += bgColor[1];
							} else {
								ansi += __Internal__.Settings.Colors.Normal[1];
							};
							if ((name === 'warn') || (name === 'error') || (name === 'info')) {
								options.isError = true;
							};
							ansi += msg + __Internal__.Settings.NewLine;
							if (color) {
								ansi += __Internal__.Settings.Colors.Normal[0];
							};
							if (bgColor) {
								ansi += __Internal__.Settings.Colors.Normal[1];
							};
							
							this.write(ansi, options);
							
							return msg;
							
						} else {
							const callback = types.get(options, 'callback');
							callback && callback(null);
						};
					}),
					
					setColumns: doodad.PROTECTED(function setColumns() {
						const newColumns = this.stdout.stream.columns;
						this.__columns = newColumns;
						__Internal__.Settings.SimpleCommands.CursorEnd = '\x1B[' + newColumns + 'G';
					}),

					onStreamResize: doodad.NODE_EVENT('resize', function onStreamResize(context) {
						if (__Internal__.osType === 'windows') {
							this.write(
								__Internal__.Settings.SimpleCommands.CursorScreenHome +
								__Internal__.Settings.SimpleCommands.EraseLine +
								__Internal__.Settings.SimpleCommands.EraseBelow +
								__Internal__.Settings.SimpleCommands.ScrollScreen
							);
							this.setColumns();
							this.refresh();
						};
					}),
					
					onReady: doodad.OVERRIDE(function onReady(ev) {
						if (!ev.prevent) {
							const data = ev.data.raw;
							if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'M')) { // Enter
								this.writeLine();
								if (__Internal__.osType !== 'windows') {
									this.setColumns();
								};
								ev.preventDefault();
							} else if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'H')) { // Backspace
								if (this.__column > 1) {
									this.write(__Internal__.Settings.SimpleCommands.CursorLeft + __Internal__.Settings.SimpleCommands.Erase + __Internal__.Settings.SimpleCommands.CursorLeft);
									this.__column--;
								} else if (this.__row > 1) {
									this.write(__Internal__.Settings.SimpleCommands.CursorUp + __Internal__.Settings.SimpleCommands.CursorEnd + __Internal__.Settings.SimpleCommands.SaveCursor + __Internal__.Settings.SimpleCommands.Erase + __Internal__.Settings.SimpleCommands.RestoreCursor);
									this.__column = this.__columns;
									this.__row--;
								};
								ev.preventDefault();
							} else if (!data.functionKeys && data.text) {
								this.writeText(data.text);
								ev.preventDefault();
							};
						};
						this._super(ev);
					}),

					
					
					// Console hook
					info: doodad.OVERRIDE(ioInterfaces.IConsole, function info(raw, /*optional*/options) {
						this[doodad.HostSymbol].consoleWrite('info', [raw], options);
					}),
					warn: doodad.OVERRIDE(ioInterfaces.IConsole, function warn(raw, /*optional*/options) {
						this[doodad.HostSymbol].consoleWrite('warn', [raw], options);
					}),
					error: doodad.OVERRIDE(ioInterfaces.IConsole, function error(raw, /*optional*/options) {
						this[doodad.HostSymbol].consoleWrite('error', [raw], options);
					}),
					log: doodad.OVERRIDE(ioInterfaces.IConsole, function log(raw, /*optional*/options) {
						this[doodad.HostSymbol].consoleWrite('log', [raw], options);
					}),
				}));

				nodejsTerminalAnsi.REGISTER(doodad.BASE(nodejsTerminalAnsi.Terminal.$extend(
				{
					$TYPE_NAME: 'CommandPrompt',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('CommandPrompt')), true) */,
					
					// TEST OVERRIDING A NODE_EVENT
					//onStreamResize: doodad.OVERRIDE(function onStreamResize(context) {
					//	this._super(context);
					//	types.DEBUGGER();
					//}),
					
					__command: doodad.PROTECTED(''),
					__commandLen: doodad.PROTECTED(0),
					__commandIndex: doodad.PROTECTED(0),
					__insertMode: doodad.PROTECTED(true),
					__homeColumn: doodad.PROTECTED(1),
					__homeRow: doodad.PROTECTED(1),
					__commandsHistory: doodad.PROTECTED(null),
					__commandsHistoryIndex: doodad.PROTECTED(-1),
					
					__savedHomeColumn: doodad.PROTECTED(1),
					__savedHomeRow: doodad.PROTECTED(1),
					__savedCommandIndex: doodad.PROTECTED(0),
					
					__questionMode: doodad.PROTECTED(false),
					__question: doodad.PROTECTED(null),
					__questionCallback: doodad.PROTECTED(null),
					__questionOptions: doodad.PROTECTED(null),
					
					__defaultHelp: doodad.PROTECTED( "Help: Type 'quit', 'exit' or 'history'" ),

					__commands: doodad.PROTECTED(doodad.ATTRIBUTE({
						help: root.DD_DOC(
								{
									author: "Claude Petit",
									revision: 0,
									params:  {
										command: {
											type: 'string,function',
											optional: true,
											description: "Command to return help for. If not specified, general help will be returned.",
										},
									},
									returns: 'string,object',
									description: "Returns help.",
								}, function(/*optional*/command) {
									if (types.isNothing(command)) {
										return types.get(this.options, 'help', this.__defaultHelp);
									} else if (types.isString(command)) {
										const fn = this.__commands[command];
										if (fn) {
											return root.GET_DD_DOC(fn);
										} else {
											return new types.Error("Unknown command '~0~'.", [command]);
										};
									} else {
										return root.GET_DD_DOC(command[_shared.OriginalValueSymbol] || command);
									};
								}),
						commands: root.DD_DOC(
								{
									author: "Claude Petit",
									revision: 0,
									params:  null,
									returns: 'object',
									description: "Returns command names with their description.",
								}, function() {
									const result = {};
									tools.forEach(this.__commands, function(cmd, name) {
										const doc = root.GET_DD_DOC(cmd);
										result[name] = doc && doc.description || "No description available.";
									}, this);
									return result;
								}),
						quit: root.DD_DOC(
								{
									author: "Claude Petit",
									revision: 0,
									params:  null,
									returns: 'undefined',
									description: "Quits the application.",
								}, function() {
									this.beforeQuit();
									tools.abortScript();
								}),
						exit: root.DD_DOC(
								{
									author: "Claude Petit",
									revision: 0,
									params:  null,
									returns: 'undefined',
									description: "Quits the application.",
								}, function() {
									this.beforeQuit();
									tools.abortScript();
								}),
						history: root.DD_DOC(
								{
									author: "Claude Petit",
									revision: 0,
									params:  null,
									returns: 'arrayof(string)',
									description: "Returns commands history.",
								}, function() {
									return types.items(types.clone(this.__commandsHistory).reverse());
								}),
					}, extenders.ExtendObject)),
					
					setOptions: doodad.OVERRIDE(function setOptions(options) {
						types.getDefault(options, 'historySize', types.getIn(this.options, 'historySize', 50));

						this._super(options);

						if (this.options.historySize > 0) {
							this.__commandsHistory = [];
						};
					}),

					beforeQuit: doodad.OVERRIDE(function quit() {
						this.eraseCursor();
						this._super();
						this.write(__Internal__.Settings.SimpleCommands.ShowCursor);
					}),

					printCursor: doodad.PROTECTED(function printCursor() {
						// FIXME: Cursor at end of line
		/*
						const chr = unicode.nextChar(this.__command, this.__commandIndex);
						this.write(
							__Internal__.Settings.SimpleCommands.HideCursor +
							__Internal__.Settings.SimpleCommands.SaveCursor
						);
						if (this.__insertMode) {
							this.write(
								((chr && !unicode.isSpace(chr.chr)) ? 
									__Internal__.Settings.Styles.BoldBlinkReverse + chr.chr + __Internal__.Settings.Styles.None 
									: 
									__Internal__.Settings.SimpleCommands.CursorBlock
								)
							);
						} else {
							this.write(
								((chr && !unicode.isSpace(chr.chr)) ? 
									__Internal__.Settings.Styles.BoldBlink + chr.chr + __Internal__.Settings.Styles.None 
									: 
									__Internal__.Settings.SimpleCommands.CursorUnderline
								)
							);
						};
						this.write(
							__Internal__.Settings.SimpleCommands.RestoreCursor
						);
						//if (__Internal__.osType === 'windows') {
						//	if (this.__column === this.__columns) {
						//		this.write(__Internal__.Settings.SimpleCommands.CursorUp);
						//	};
						//} else {
						//		??????
						//};
		*/
					}),
					
					eraseCursor: doodad.PROTECTED(function eraseCursor() {
						// FIXME: Cursor at end of line
/*
						const chr = unicode.nextChar(this.__command, this.__commandIndex);
						this.write(
							__Internal__.Settings.SimpleCommands.SaveCursor + 
							(chr ? chr.chr : __Internal__.Settings.SimpleCommands.Erase) + 
							__Internal__.Settings.SimpleCommands.RestoreCursor
						);
*/
					}),
					
					writeLine: doodad.OVERRIDE(function writeLine(text, /*optional*/options) {
						this.eraseCursor();
						
						this._super(text, options);
					}),
					
					printPrompt: doodad.PROTECTED(function printPrompt() {
						this.resetPosition();
						this.write(
							__Internal__.Settings.SimpleCommands.EraseLine +
							__Internal__.Settings.SimpleCommands.CursorHome
						);
						if (this.__questionMode) {
							this.writeText(this.__question + ' ');
						} else {
							this.writeText(types.get(this.options, 'prompt', '>>> '));
						};
						this.__homeColumn = this.__column;
						this.__homeRow = this.__row;
					}),
					
					runCommand: doodad.PROTECTED(doodad.MUST_OVERRIDE()), //function runCommand(command, /*optional*/options)
					
					listen: doodad.OVERRIDE(function listen(/*optional*/options) {
						this._super(options);
						
						this.printPrompt();
						this.printCursor();
					}),

					saveCursor: doodad.OVERRIDE(function saveCursor() {
						this._super();
						
						this.__savedHomeColumn = this.__homeColumn;
						this.__savedHomeRow = this.__homeRow;
						this.__savedCommandIndex = this.__commandIndex;
					}),
					restoreCursor: doodad.OVERRIDE(function restoreCursor() {
						this.__homeColumn = this.__savedHomeColumn;
						this.__homeRow = this.__savedHomeRow;
						this.__commandIndex = this.__savedCommandIndex;

						this._super();
					}),
					resetPosition: doodad.OVERRIDE(function resetPosition() {
						this._super();
						
						this.__homeColumn = 1;
						this.__homeRow = 1;
						this.__commandIndex = 0;
					}),
					
					reset: doodad.OVERRIDE(function reset() {
						this._super();

						this.__command = '';
						this.__commandLen = 0;
						this.__insertMode = true;
						this.__questionMode = false;
						this.__question = '';
						this.__questionCallback = null;
						this.__questionOptions = null;
					}),

					clear: doodad.OVERRIDE(function clear() {
						this._super();

						this.__command = '';
						this.__commandLen = 0;
					}),
					
					refresh: doodad.OVERRIDE(function refresh() {
						this._super();
						
						this.printPrompt();
						this.printCursor();
						
						if (this.__command) {
							this.writeText(this.__command);
							this.__commandIndex = this.__command.length;
						};
						
					}),

					ask: doodad.PUBLIC(function ask(question, callback, /*optional*/options) {
						if (this.__questionMode) {
							throw new types.NotAvailable();
						};
						this.__questionMode = true;
						this.__question = question;
						this.__questionCallback = callback;
						this.__questionOptions = options;
						this.refresh();
					}),

					askAsync: doodad.PUBLIC(doodad.ASYNC(function askAsync(question, /*optional*/options) {
						const Promise = types.getPromise();
						return Promise.create(function(resolve, reject) {
							this.ask(question, resolve, options);
						}, this);
					})),

					addCommandHistory: doodad.PROTECTED(function addCommandHistory(command, /*optional*/replace) {
						if (command && this.__commandsHistory) {
							if (replace && (this.__commandsHistoryIndex >= 0) && (this.__commandsHistoryIndex < this.__commandsHistory.length)) {
								this.__commandsHistory[this.__commandsHistoryIndex] = command;
							} else if (!replace && (command !== this.__commandsHistory[0])) {
								this.__commandsHistory.unshift(command);
								if (this.__commandsHistory.length > this.options.historySize) {
									this.__commandsHistory.pop();
								};
							};
							this.__commandsHistoryIndex = -1;
						};
					}),
					
					__moveToEnd: doodad.PROTECTED(function __moveToEnd() {
						this.eraseCursor();

						const dims = this.calculateTextDims(this.__command);
								
						let rows = this.__homeRow + dims.rows;
						let columns = this.__homeColumn + dims.columns;
								
						if (columns > this.__columns) {
							rows += _shared.Natives.mathFloor(columns / this.__columns);
							columns = (columns % this.__columns);
						};
								
						this.write(	
							((this.__row > 0) && (rows > this.__row) ? tools.format("\u001B[~0~B", [rows - this.__row]) : '') + // CursorDown X Times
							__Internal__.Settings.SimpleCommands.CursorHome +
							((columns > 1) ? tools.format("\u001B[~0~C", [columns - 1]) : '') // CursorRight X Times
						);

						this.__column = columns;
						this.__row = rows;
						this.__commandIndex = this.__command.length;
					}),

					onReady: doodad.OVERRIDE(function onReady(ev) {
						// TODO: Auto-completion
						// TODO: Hints
						let callSuper = true;
						if (!ev.prevent) {
							const data = ev.data.raw;
							if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'M')) { // Enter
								this._super(ev);
								callSuper = false;
								this.__moveToEnd();
								const command = this.__command;
								this.__command = '';
								this.__commandLen = 0;
								if (this.__questionMode) {
									const qcb = this.__questionCallback;
									this.writeLine();
									this.reset();
									if (qcb) {
										qcb(command);
									};
								} else if (command) {
									const cmd = command.trim();
									this.addCommandHistory(cmd);
									this.runCommand(cmd);
								};
								this.reset();
								this.printPrompt();
								this.printCursor();
								ev.preventDefault();
							} else if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'H')) { // Backspace
								const chr = unicode.prevChar(this.__command, this.__commandIndex);
								if (chr) {
									this.eraseCursor();
									const end = this.__command.slice(this.__commandIndex);
									this.__command = this.__command.slice(0, this.__commandIndex - chr.size) + end;
									this.__commandLen--;
									this.__commandIndex -= chr.size;
									this._super(ev);
									callSuper = false;
									if (end) {
										this.write(__Internal__.Settings.SimpleCommands.SaveCursor + end + __Internal__.Settings.SimpleCommands.Erase + __Internal__.Settings.SimpleCommands.RestoreCursor);
									};
									this.printCursor();
								} else {
									ev.preventDefault();
								};
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.Home)) {  // Home
								this.eraseCursor();

								const moveUpCount = this.__row - this.__homeRow;
								this.write(	
									(moveUpCount > 0 ? tools.format("\u001B[~0~A", [moveUpCount]) : '') + // CursorUp X Times
									__Internal__.Settings.SimpleCommands.CursorHome +
									(this.__homeColumn > 1 ? tools.format("\u001B[~0~C", [this.__homeColumn - 1]) : '') // CursorRight X Times
								);
								
								this.__column = this.__homeColumn;
								this.__row = this.__homeRow;
								this.__commandIndex = 0;
								
								this.printCursor();

								ev.preventDefault();
								
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.End)) {  // End
								this.__moveToEnd();
								
								this.printCursor();

								ev.preventDefault();
								
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.LeftArrow)) {  // Left Arrow
								const chr = unicode.prevChar(this.__command, this.__commandIndex);
								if (chr) {
									this.eraseCursor();
									if (this.__column <= 1) {
										if (this.__row > 1) {
											this.write(__Internal__.Settings.SimpleCommands.CursorUp + __Internal__.Settings.SimpleCommands.CursorEnd);
											this.__column = this.__columns;
											this.__row--;
										};
									} else {
										this.write(__Internal__.Settings.SimpleCommands.CursorLeft);
										this.__column--;
									};
									this.__commandIndex -= chr.size;
									this.printCursor();
								};
								ev.preventDefault();
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.RightArrow)) {  // Right Arrow
								const chr = unicode.nextChar(this.__command, this.__commandIndex);
								if (chr) {
									this.eraseCursor();
									if (this.__column >= this.__columns) {
										this.write(__Internal__.Settings.SimpleCommands.CursorDown + __Internal__.Settings.SimpleCommands.CursorHome);
										this.__column = 1;
										this.__row++;
									} else {
										this.write(__Internal__.Settings.SimpleCommands.CursorRight);
										this.__column++;
									};
									this.__commandIndex += chr.size;
									this.printCursor();
								};
								ev.preventDefault();
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.UpArrow)) {  // Up Arrow
								if (this.__commandsHistory && !this.__questionMode) {
									if (this.__commandsHistoryIndex + 1 < this.__commandsHistory.length) {
										this.eraseCursor();
										if ((this.__commandsHistoryIndex < 0) && (this.__command)) {
											this.addCommandHistory(this.__command, true);
										};
										this.write(	
											(this.__row > 1 ? tools.format("\u001B[~0~A", [this.__row - 1]) : '') + // CursorUp X Times
											__Internal__.Settings.SimpleCommands.EraseBelow
										);
										this.reset();
										this.printPrompt();
										this.__commandsHistoryIndex++;
										this.__command = this.__commandsHistory[this.__commandsHistoryIndex];
										this.__commandIndex = this.__command.length;
										this.writeText(this.__command);
										this.printCursor();
									};
								};
								ev.preventDefault();
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.DownArrow)) {  // Down Arrow
								if (this.__commandsHistory && !this.__questionMode) {
									this.eraseCursor();
									if ((this.__commandsHistoryIndex < 0) && (this.__command)) {
										this.addCommandHistory(this.__command, true);
									};
									this.write(	
										(this.__row > 1 ? tools.format("\u001B[~0~A", [this.__row - 1]) : '') + // CursorUp X Times
										__Internal__.Settings.SimpleCommands.EraseBelow
									);
									this.reset();
									this.printPrompt();
									this.printCursor();
									if (this.__commandsHistory) {
										if (this.__commandsHistoryIndex - 1 >= 0) {
											this.__commandsHistoryIndex--;
											this.__command = this.__commandsHistory[this.__commandsHistoryIndex];
											this.writeText(this.__command);
											this.__commandIndex = this.__command.length;
										} else {
											this.__commandsHistoryIndex = -1;
										};
									};
								};
								ev.preventDefault();
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.Insert)) {  // Insert
								this.__insertMode = !this.__insertMode;
								this.printCursor();
								ev.preventDefault();
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.Delete)) {  // Delete
								const chr = unicode.nextChar(this.__command, this.__commandIndex);
								if (chr) {
									this.eraseCursor();
									const end = this.__command.slice(this.__commandIndex + chr.size);
									this.__command = this.__command.slice(0, this.__commandIndex) + end;
									this.__commandLen--;
									this.write(__Internal__.Settings.SimpleCommands.SaveCursor + end + tools.repeat(__Internal__.Settings.SimpleCommands.Erase, chr.size) + __Internal__.Settings.SimpleCommands.RestoreCursor);
									this.printCursor();
								};
								ev.preventDefault();
							} else if (!data.functionKeys && data.text) {  // Visible chars
								let chr = unicode.nextChar(this.__command, this.__commandIndex);
								let end = '';
								if (chr) {
									end = this.__command.slice(this.__commandIndex + (this.__insertMode ? 0 : chr.size));
								};
								
								const len = unicode.charsCount(data.text);

								if ((this.__commandLen + len) <= types.get(this.options, 'maxCommandLength', 1024)) {
									this.__command = this.__command.slice(0, this.__commandIndex) + data.text + end;
									this.__commandLen += len;
									this.__commandIndex += data.text.length;
									this.writeText(data.text);
									if (end) {
										this.saveCursor();
										
										this.writeText(end);
										
										// <PRB> Since ?????, the cursor behaves weird, both on Windows and Linux
										let fixCursor = false;
										if (__Internal__.osType === 'windows') {
											fixCursor = (this.__column === 1);
										} else {
											fixCursor = (this.__column === 2);
										};

										this.restoreCursor();
										
										if (fixCursor) {
											this.write(__Internal__.Settings.SimpleCommands.CursorUp);
										};
									};
									this.printCursor();
								};
								
								ev.preventDefault();
							};
						};
						if (callSuper) {
							this._super(ev);
						};
					}),
				})));

				nodejsTerminalAnsi.REGISTER(nodejsTerminalAnsi.CommandPrompt.$extend(
				{
					$TYPE_NAME: 'Javascript',
					$TYPE_UUID: '' /*! INJECT('+' + TO_SOURCE(UUID('Javascript')), true) */,
					
					__globals: doodad.PROTECTED(  null  ),

					__defaultHelp: doodad.PROTECTED( "Help: Type Javascript expressions, or type 'commands' to get a list of available commands." ),
					
					__commands: {
						globals: root.DD_DOC(
								{
									author: "Claude Petit",
									revision: 0,
									params:  null,
									returns: 'arrayof(string)',
									description: "Returns a list of global variables.",
								}, function() {
									return types.keys(this.__globals);
								}),
					},
					
					
					create: doodad.OVERRIDE(function create(number, /*optional*/options) {
						const Promise = types.getPromise();

						this._super(number, options);
						
						const locals = types.get(options, 'locals', {root: root});

						const commands = types.extend({}, this.__commands, types.get(options, 'commands'));

						const inspectSymbol = nodejs.getCustomInspectSymbol();

						const createInspect = function _createInspect(fn, /*optional*/args) {
							const self = this;
							return function(/*paramarray*/) {
								let result = fn.apply(self, args);
								if (types.isPromise(result)) {
									result = result
										.nodeify(self.__printAsyncResult, self);
								};
								return result;
							};
						};

						tools.forEach(commands, function(fn, name) {
							this.__commands[name] = fn;
							fn = _shared.makeInside(this, fn, _shared.SECRET);
							fn[inspectSymbol] = createInspect.call(this, fn);
							commands[name] = fn;
						}, this);
						
						this.__globals = types.extend({}, locals, commands);
					}),
					
					__printAsyncResult: doodad.PROTECTED(function printAsyncResult(err, value) {
						let ansi;
						try {
							ansi = nodeUtil.inspect(err || value, {colors: !err});
						} catch(ex) {
							if (ex instanceof types.ScriptInterruptedError) {
								throw ex;
							};
							err = true;
							ansi = nodeUtil.inspect(ex);
						};
						if (err) {
							this.consoleWrite('error', [ansi], {callback: doodad.AsyncCallback(this, function(err) {
								if (!err) {
									this.refresh();
								};
							})});
						} else {
							this.consoleWrite('log', [ansi], {callback: doodad.AsyncCallback(this, function(err) {
								if (!err) {
									this.refresh();
								};
							})});
						};
					}),
					
					runCommand: doodad.OVERRIDE(function runCommand(command, /*optional*/options) {
						const Promise = types.getPromise();
						command = tools.trim(command);
						if (!command) {
							return;
						};
						let result,
							failed = false,
							exitHandler = null;
						tools.addEventListener('exit', exitHandler = function(ev) {
							if (!ev.detail.error.critical) {
								ev.preventDefault();
							};
						});
						try {
							if (types.get(this.options, 'restricted', true)) {
								result = safeEval.eval(command, this.__globals);
							} else {
								result = safeEval.createEval(types.keys(this.__globals))
								result = result.apply(null, types.values(this.__globals));
								result = result(command);
							};
						} catch(ex) {
							if (ex.bubble) {
								throw ex;
							};
							result = ex;
							failed = true;
						} finally {
							tools.removeEventListener('exit', exitHandler);
						};
						let text;
						try {
							text = nodeUtil.inspect(result, {colors: !failed, customInspect: true});
						} catch(ex) {
							if (ex.bubble) {
								throw ex;
							};
							result = ex;
							failed = true;
							text = nodeUtil.inspect(ex, {colors: false});
						};
						if (failed) {
							this.write(__Internal__.Settings.Colors.Red[0]);
						};
						this.writeLine();
						this.write(text);
						this.writeLine();
						if (failed) {
							this.write(__Internal__.Settings.Colors.Normal[0]);
						};
						if (types.isPromise(result)) {
							Promise.resolve(result)
								.nodeify(this.__printAsyncResult, this);
						};
					}),
					
				}));
				
				__Internal__.parseSettings = function parseSettings(err, data) {
					if (!err) {
						data = data.nodejsTerminal;
						__Internal__.Settings.Keyboard = nodejsTerminalAnsi.computeKeyboard(data.keyboard);
						__Internal__.Settings.NewLine = data.newLine;
						__Internal__.Settings.Colors = data.colors;
						__Internal__.Settings.Styles = data.styles;
						__Internal__.Settings.EnterKey = data.enterKey;
						const cursorEnd = __Internal__.Settings.SimpleCommands && __Internal__.Settings.SimpleCommands.CursorEnd;
						__Internal__.Settings.SimpleCommands = data.simpleCommands;
						if (cursorEnd) {
							__Internal__.Settings.SimpleCommands.CursorEnd = cursorEnd;
						};
						return data;
					};
				};
				
				nodejsTerminal.ADD('loadSettings', function loadSettings(/*optional*/callback) {
					//return modules.locate('doodad-js-terminal').then(function (location) {
						const path = files.Path.parse(module.filename).set({file: ''}).combine('./res/nodejsTerminal.json', {os: 'linux'});
						//return config.load(path, { async: true, watch: true, configPath: location, encoding: 'utf-8' }, [__Internal__.parseSettings, callback]);
						return config.load(path, { async: true, watch: true, encoding: 'utf-8' }, [__Internal__.parseSettings, callback]);
					//});
				});

				
				return function init(/*optional*/options) {
					return nodejsTerminal.loadSettings();
				};
			},
		};
		return DD_MODULES;
	},
};
//! END_MODULE()