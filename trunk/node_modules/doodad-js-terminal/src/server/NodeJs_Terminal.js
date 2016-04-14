//! REPLACE_BY("// Copyright 2016 Claude Petit, licensed under Apache License version 2.0\n", true)
// dOOdad - Object-oriented programming framework
// File: NodeJs_Terminal.js - NodeJs Terminal
// Project home: https://sourceforge.net/projects/doodad-js/
// Trunk: svn checkout svn://svn.code.sf.net/p/doodad-js/code/trunk doodad-js-code
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2016 Claude Petit
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

(function() {
	const global = this;

	const exports = {};
	
	//! BEGIN_REMOVE()
	if ((typeof process === 'object') && (typeof module === 'object')) {
	//! END_REMOVE()
		//! IF_DEF("serverSide")
			module.exports = exports;
		//! END_IF()
	//! BEGIN_REMOVE()
	};
	//! END_REMOVE()
	
	exports.add = function add(DD_MODULES) {
		DD_MODULES = (DD_MODULES || {});
		DD_MODULES['Doodad.NodeJs.Terminal'] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE() */,
			namespaces: ['Ansi'],
			
			create: function create(root, /*optional*/_options) {
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
				};
				
				const __Natives__ = {
					mathFloor: global.Math.floor,
					mathMin: global.Math.min,
					mathMax: global.Math.max,
					mathAbs: global.Math.abs,
					mathSign: global.Math.sign,
					
					stringFromCharCode: String.fromCharCode,
				};
				
				nodejsTerminalAnsi.Keyboard = null;
				nodejsTerminalAnsi.Colors = null;
				nodejsTerminalAnsi.NewLine = null;
				nodejsTerminalAnsi.SimpleCommands = null;
				
				nodejsTerminalAnsi.computeKeyboard = function computeKeyboard(keyboard) {
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
											regExp += tools.escapeRegExp(String.fromCharCode(parseInt(chr[0]))) + '-' + tools.escapeRegExp(String.fromCharCode(parseInt(chr[1])));
										} else if (types.isInteger(chr)) {
											regExp += tools.escapeRegExp(String.fromCharCode(chr));
										};
									};
									regExp += ']';
								};
							} else if (types.isString(chr)) {
								chr = chr.split('-');
								regExp += '[' + tools.escapeRegExp(String.fromCharCode(parseInt(chr[0]))) + '-' + tools.escapeRegExp(String.fromCharCode(parseInt(chr[1]))) + ']';
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
				};
				
				nodejsTerminalAnsi.parseKeys = function parseKeys(ansi, /*optional*/pos, /*optional*/maxKeysCount) {
					ansi = types.toString(ansi).replace(/(\r\n)|(\n\r)|\r|\n/gm, nodejsTerminalAnsi.EnterKey);
					
					pos = (pos || 0);
					maxKeysCount = (maxKeysCount || Infinity);
					
					const keys = [];

					const keyboard = nodejsTerminalAnsi.Keyboard;
					const entries = types.keys(keyboard);

					while ((pos < ansi.length) && (keys.length < maxKeysCount)) {
						const key = {};
						
						let size = 1;
						let found = false;
						scanKeyboard: for (let k = 0; k < entries.length; k++) {
							let name = entries[k];
							
							const regEx = keyboard[name];
							regEx.lastIndex = pos;
							const match = regEx.exec(ansi);
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
										size += nextKey.raw.length;
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
						
						key.raw = ansi.slice(pos, pos + size);
						keys.push(key);
						
						pos += size;
					};
					
					return keys;
				};

				nodejsTerminalAnsi.toText = function toText(ansi) {
					ansi = types.toString(ansi);
					ansi = ansi.replace(/(\r\n)|(\n\r)|\r|\n/gm, nodejsTerminalAnsi.NewLine);
					ansi = ansi.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/gm, '');
					return ansi;
				};
				
				nodejsTerminalAnsi.REGISTER(io.Stream.$extend(
									ioMixIns.KeyboardInput,
									ioMixIns.TextOutput,
									ioInterfaces.IConsole,
									mixIns.NodeEvents,
				{
					$TYPE_NAME: 'Terminal',
					
					number: doodad.PUBLIC(doodad.READ_ONLY(null)),
					stdin: doodad.PUBLIC(doodad.READ_ONLY(null)),
					stdout: doodad.PUBLIC(doodad.READ_ONLY(null)),
					stderr: doodad.PUBLIC(doodad.READ_ONLY(null)),
					
					__listening: doodad.PROTECTED(false),
					
					__column: doodad.PROTECTED(0),
					__row: doodad.PROTECTED(0),
					__columns: doodad.PROTECTED(0),
					
					__savedColumn: doodad.PROTECTED(0),
					__savedRow: doodad.PROTECTED(0),
					
					__stdinBuffer: doodad.PROTECTED(null),
					__stdoutBuffer: doodad.PROTECTED(null),
					__stderrBuffer: doodad.PROTECTED(null),
					
					__consoleWritesCount: doodad.PROTECTED(null),
					__consoleWritesIntervalId: doodad.PROTECTED(null),
					
					create: doodad.OVERRIDE(function create(number, /*optional*/options) {
						this._super(options);
						
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
							"Invalid 'stdin', 'stdout', 'stderr'."
						);
						types.setAttributes(this, attrs);

						types.getDefault(options, 'writesLimit', 40)
						
						this.__stdinBuffer = [];
						this.__stdoutBuffer = [];
						this.__stderrBuffer = [];
						
						this.onStreamResize.attach(this.stdout.stream);
						this.resetPosition();
						this.setColumns();
						this.__consoleWritesCount = {};
						this.__consoleWritesIntervalId = setInterval(new doodad.Callback(this, function() {
							const self = this;
							tools.forEach(this.__consoleWritesCount, function(count, name) {
								self.__consoleWritesCount[name] = 0;
							});
						}), 2000);
					}),
					destroy: doodad.OVERRIDE(function destroy() {
						this.stopListening();
						this.onStreamResize.clear();
						if (this.__consoleWritesIntervalId) {
							clearInterval(this.__consoleWritesIntervalId);
							this.__consoleWritesIntervalId = null;
						};
						this._super();
					}),
					
					__onStdInReady: doodad.PROTECTED(function onStdInReady(ev) {
						const data = nodejsTerminalAnsi.parseKeys(ev.data.text);

						let key;
						while (key = data.shift()) {
							if (!types.get(this.options, 'ignoreCtrlC', false) && (key.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (key.text === 'C')) { // CTRL+C
								this.writeLine();
								this.flush();
								tools.abortScript();
								break;  // <<< should not be executed
							} else {
								const readyEv = new doodad.Event(key);
								this.onReady(readyEv);
								if (!readyEv.prevent) {
									if (this.__stdinBuffer.length < this.options.bufferSize) {
										this.__stdinBuffer.push(key);
									} else {
										data.unshift(key);
										break;
									};
								};
							};
						};
						
						if (!data.length) {
							ev.preventDefault();
						};
					}),
					
					isListening: doodad.OVERRIDE(function isListening() {
						return this.__listening;
					}),
					listen: doodad.OVERRIDE(function listen(/*optional*/options) {
						if (!this.__listening) {
							this.__listening = true;
							this.stdin.onReady.attach(this, this.__onStdInReady);
							this.stdin.listen(options);
							__Internal__.currentTerminal = this;
							__Internal__.oldStdIn = io.stdin;
							__Internal__.oldStdOut = io.stdout;
							__Internal__.oldStdErr = io.stderr;
							io.setStds({
								stdin: this,
								stdout: this,
								stderr: this,
							});
						};
					}),
					stopListening: doodad.OVERRIDE(function stopListening() {
						if (this.__listening) {
							this.__listening = false;
							io.setStds({
								stdin: __Internal__.oldStdIn,
								stdout: __Internal__.oldStdOut,
								stderr: __Internal__.oldStdErr,
							});
							__Internal__.oldStdIn = null;
							__Internal__.oldStdOut = null;
							__Internal__.oldStdErr = null;
							this.stdin.onReady.detach(this, this.__onStdInReady);
							this.stdin.stopListening();
						};
					}),
					
					saveCursor: doodad.PUBLIC(function saveCursor() {
						this.write(nodejsTerminalAnsi.SimpleCommands.SaveCursor);
						this.flush();
						
						this.__savedColumn = this.__column;
						this.__savedRow = this.__row;
					}),
					restoreCursor: doodad.PUBLIC(function restoreCursor() {
						this.__column = __Natives__.mathMin(this.__savedColumn, this.__columns);
						this.__row = this.__savedRow;
						
						this.write(nodejsTerminalAnsi.SimpleCommands.RestoreCursor);
						this.flush();
					}),
					resetPosition: doodad.PUBLIC(function resetPosition() {
						this.__column = 1;
						this.__row = 1;
					}),
					
					refresh: doodad.PUBLIC(doodad.METHOD()),
					
					reset: doodad.OVERRIDE(function reset() {
						this._super();

						this.__stdinBuffer = [];
						this.__stdoutBuffer = [];
						this.__stderrBuffer = [];

						this.resetPosition();
					}),

					clear: doodad.OVERRIDE(function clear() {
						this._super();
						
						this.resetPosition();
					}),
					
					read: doodad.OVERRIDE(function read(/*optional*/options) {
						const count = types.get(options, 'count');

						if (root.DD_ASSERT) {
							root.DD_ASSERT(types.isNothing(count) || types.isInteger(count), "Invalid count.");
						};

						if (types.isNothing(count)) {
							return this.__stdinBuffer.shift();
						} else {
							return this.__stdinBuffer.splice(0, count);
						};
					}),

					getCount: doodad.OVERRIDE(function getCount(/*optional*/options) {
						return this.__stdinBuffer.length;
					}),
					
					write: doodad.OVERRIDE(function write(ansi, /*optional*/options) {
						ansi = types.toString(ansi);
						
						let data = {
							raw: ansi,
							options: options,
						};
						data = this.transform(data, options) || data;
						
						this.onWrite(new doodad.Event(data));
						
						const getBuffer = function getBuffer() {
							return ((this.stderr !== this.stdout) && types.get(options, 'isError', false) ? this.__stderrBuffer : this.__stdoutBuffer);
						};
						
						const buffer = getBuffer.apply(this),
							bufferSize = this.options.bufferSize,
							callback = types.get(options, 'callback');
						
						if (this.options.autoFlush) {
							buffer.push(data);
							if ((data.raw === io.EOF) || (buffer.length >= bufferSize)) {
								this.flush({
									callback: callback,
								});
							} else {
								if (callback) {
									callback();
								};
							};
						} else if (buffer.length < bufferSize) {
							buffer.push(data);
							if (callback) {
								callback();
							};
						} else {
							throw new types.BufferOverflow();
						};
					}),
					
					calculateTextDims: doodad.PROTECTED(function calculateTextDims(text, /*optional*/options) {
						text = nodejsTerminalAnsi.toText(text);
						
						const lines = text.split(nodejsTerminalAnsi.NewLine),
							linesLen = lines.length;
							
						let columns = 0,
							rows = 0;
							
						for (let i = 0; i < linesLen; i++) {
							const line = lines[i];
							
							const lineLen = unicode.charsCount(line);
							if (lineLen) {
								rows += __Natives__.mathFloor(lineLen / this.__columns);
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
							this.__row += __Natives__.mathFloor(this.__column / this.__columns);
							this.__column = (this.__column % this.__columns);
						};
						
						this.write(text, options);
					}),

					flush: doodad.OVERRIDE(function flush(/*optional*/options) {
						const callback = types.get(options, 'callback');
						
						function __flush(stream, buffer, /*optional*/callback) {
							let ansi = '';
							while (buffer.length) {
								const data = buffer.shift();
								if (data.raw !== io.EOF) {
									ansi += data.valueOf();
								};
							};
							stream.write(ansi, types.extend({}, options, {callback: callback}));
						};
						
						__flush(this.stdout, this.__stdoutBuffer, new doodad.Callback(this, function() {
							__flush(this.stderr, this.__stderrBuffer, new doodad.Callback(this, function() {
								this.onFlush(new doodad.Event({
									options: options,
								}));
								if (callback) {
									callback();
								};
							}));
						}));
					}),
					
					consoleWrite: doodad.PUBLIC(function consoleWrite(name, args, /*optional*/options) {
						const writesName = (name === 'error' ? name : 'log');
						if (!types.hasKey(this.__consoleWritesCount, writesName)) {
							this.__consoleWritesCount[writesName] = 0;
						};
						if (this.__consoleWritesCount[writesName] === this.options.writesLimit) {
							args = ["... (console writes limit reached)"];
						};
						if (this.__consoleWritesCount[writesName] <= this.options.writesLimit) {
							const msg = nodeUtil.format.apply(nodeUtil, args)
							
							this.__consoleWritesCount[writesName]++;
							
							let ansi = '';
							
							ansi +=
								(this.__row > 1 ? tools.format("\u001B[~0~A", [this.__row - 1]) : '') + // CursorUp X times
								nodejsTerminalAnsi.SimpleCommands.EraseLine + 
								nodejsTerminalAnsi.SimpleCommands.EraseBelow + 
								nodejsTerminalAnsi.SimpleCommands.CursorHome;
								
							options = types.extend({}, this.options, options);
							const color = nodejsTerminalAnsi.Colors[types.get(options, name + 'Color', null)];
							if (color) {
								ansi += color[0];
							} else {
								ansi += nodejsTerminalAnsi.Colors.Normal[0];
							};
							const bgColor = nodejsTerminalAnsi.Colors[types.get(options, name + 'BgColor', null)];
							if (bgColor) {
								ansi += bgColor[1];
							} else {
								ansi += nodejsTerminalAnsi.Colors.Normal[1];
							};
							if ((name === 'warn') || (name === 'error') || (name === 'info')) {
								options.isError = true;
							};
							ansi += msg + nodejsTerminalAnsi.NewLine;
							if (color) {
								ansi += nodejsTerminalAnsi.Colors.Normal[0];
							};
							if (bgColor) {
								ansi += nodejsTerminalAnsi.Colors.Normal[1];
							};
							
							this.write(ansi, options);
							this.flush();
							
							this.refresh();
							
							return msg;
						};
					}),
					
					setColumns: doodad.PROTECTED(function setColumns() {
						const newColumns = this.stdout.stream.columns;
						this.__columns = newColumns;
						nodejsTerminalAnsi.SimpleCommands.CursorEnd = '\x1B[' + newColumns + 'G';
					}),

					onStreamResize: doodad.NODE_EVENT('resize', function onStreamResize() {
						if (__Internal__.osType === 'windows') {
							this.write(
								nodejsTerminalAnsi.SimpleCommands.CursorScreenHome +
								nodejsTerminalAnsi.SimpleCommands.EraseLine +
								nodejsTerminalAnsi.SimpleCommands.EraseBelow +
								nodejsTerminalAnsi.SimpleCommands.ScrollScreen
							);
							this.flush();
							this.setColumns();
							this.refresh();
						};
					}),
					
					onReady: doodad.OVERRIDE(function onReady(ev) {
						if (ev.prevent) {
							this._super(ev);
						} else {
							const data = ev.data;
							if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'M')) { // Enter
								this.writeLine();
								this.flush();
								if (__Internal__.osType !== 'windows') {
									this.setColumns();
								};
								ev.preventDefault();
								this._super(ev);
							} else if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'H')) { // Backspace
								//this.write('\x1B[6n');  // Report Cursor Position
								//this.write('\x1B?6n');  // Report Cursor Position
								if (this.__column > 1) {
									this.write(nodejsTerminalAnsi.SimpleCommands.CursorLeft + nodejsTerminalAnsi.SimpleCommands.Erase + nodejsTerminalAnsi.SimpleCommands.CursorLeft);
									this.flush();
									this.__column--;
								} else if (this.__row > 1) {
									if (__Internal__.osType === 'windows') {
										this.write(nodejsTerminalAnsi.SimpleCommands.CursorUp + nodejsTerminalAnsi.SimpleCommands.CursorEnd + nodejsTerminalAnsi.SimpleCommands.Erase + nodejsTerminalAnsi.SimpleCommands.CursorUp + nodejsTerminalAnsi.SimpleCommands.CursorEnd);
									} else {
										this.write(nodejsTerminalAnsi.SimpleCommands.CursorUp + nodejsTerminalAnsi.SimpleCommands.CursorEnd + nodejsTerminalAnsi.SimpleCommands.Erase + nodejsTerminalAnsi.SimpleCommands.CursorEnd);
									};
									this.flush();
									this.__column = this.__columns;
									this.__row--;
								};
								ev.preventDefault();
								this._super(ev);
							} else if (!data.functionKeys && data.text) {
								this.writeText(data.text);
								this.flush();
								ev.preventDefault();
								this._super(ev);
							} else {
								ev.preventDefault();
								this._super(ev);
							};
						};
					}),

					
					
					// Console hook
					info: doodad.OVERRIDE(ioInterfaces.IConsole, function info(raw, /*optional*/options) {
						this.__host.consoleWrite('info', [raw], options);
					}),
					warn: doodad.OVERRIDE(ioInterfaces.IConsole, function warn(raw, /*optional*/options) {
						this.__host.consoleWrite('warn', [raw], options);
					}),
					error: doodad.OVERRIDE(ioInterfaces.IConsole, function error(raw, /*optional*/options) {
						this.__host.consoleWrite('error', [raw], options);
					}),
					log: doodad.OVERRIDE(ioInterfaces.IConsole, function log(raw, /*optional*/options) {
						this.__host.consoleWrite('log', [raw], options);
					}),
				}));

				nodejsTerminalAnsi.REGISTER(doodad.BASE(nodejsTerminalAnsi.Terminal.$extend(
				{
					$TYPE_NAME: 'CommandPrompt',
					
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
					
					__commands: doodad.PROTECTED(doodad.ATTRIBUTE({
						help: function() {
							return types.get(this.options, 'help', "Type 'quit', 'exit' or history'");
						},
						quit: function() {
							tools.abortScript();
						},
						exit: function() {
							tools.abortScript();
						},
						history: function() {
							return types.items(types.clone(this.__commandsHistory).reverse());
						},
					}, extenders.ExtendObject)),
					
					// <PRB> Since ?????, the cursor behaves differently
					
					create: doodad.OVERRIDE(function create(number, /*optional*/options) {
						this._super(number, options);
						
						const historySize = types.getDefault(this.options, 'historySize', 500);
						
						if (historySize > 0) {
							this.__commandsHistory = [];
						};
					}),
					
					printPrompt: doodad.PROTECTED(function printPrompt() {
						this.resetPosition();
						this.write(
							nodejsTerminalAnsi.SimpleCommands.EraseLine +
							nodejsTerminalAnsi.SimpleCommands.CursorHome
						);
						if (this.__questionMode) {
							this.writeText(this.__question + ' ');
						} else {
							this.writeText(types.get(this.options, 'prompt', '>>> '));
						};
						this.flush();
						this.__homeColumn = this.__column;
						this.__homeRow = this.__row;
					}),
					
					runCommand: doodad.PROTECTED(doodad.MUST_OVERRIDE()), //function runCommand(command, /*optional*/options)
					
					listen: doodad.OVERRIDE(function listen(/*optional*/options) {
						this._super(options);
						
						this.printPrompt();
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
						
						if (this.__command) {
							this.writeText(this.__command);
							this.__commandIndex = this.__command.length;
						};
						
						this.flush();
					}),

					ask: doodad.PUBLIC(function ask(question, callback, /*optional*/options) {
						const qcb = this.__questionMode && this.__questionCallback;
						if (qcb) {
							// Previous question cancelled.
							qcb('');
						};
						this.__questionMode = true;
						this.__question = question;
						this.__questionCallback = callback;
						this.__questionOptions = options;
						this.refresh();
					}),

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
					
					onReady: doodad.OVERRIDE(function onReady(ev) {
						// TODO: Auto-completion
						// TODO: Hints
						if (ev.prevent) {
							this._super(ev);
						} else {
							const data = ev.data;
							if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'M')) { // Enter
								const command = this.__command;
								this.__command = '';
								this.__commandLen = 0;
								if (this.__questionMode) {
									const qcb = this.__questionCallback;
									this.writeLine();
									this.flush();
									this.reset();
									if (qcb) {
										qcb(command);
									};
								} else if (command) {
									this.addCommandHistory(command);
									this.runCommand(command);
								};
								this._super(ev);
								this.reset();
								this.printPrompt();
							} else if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'H')) { // Backspace
								const chr = unicode.prevChar(this.__command, this.__commandIndex);
								if (chr) {
									const end = this.__command.slice(this.__commandIndex);
									this.__command = this.__command.slice(0, this.__commandIndex - chr.size) + end;
									this.__commandLen--;
									this.__commandIndex -= chr.size;
									this._super(ev);
									if (end) {
										this.write(nodejsTerminalAnsi.SimpleCommands.SaveCursor + end + nodejsTerminalAnsi.SimpleCommands.Erase + nodejsTerminalAnsi.SimpleCommands.RestoreCursor);
										this.flush();
									};
								} else {
									ev.preventDefault();
									this._super(ev);
								};
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.Home)) {  // Home
								const moveUpCount = this.__row - this.__homeRow;
								this.write(	
									(moveUpCount > 0 ? tools.format("\u001B[~0~A", [moveUpCount]) : '') + // CursorUp X Times
									nodejsTerminalAnsi.SimpleCommands.CursorHome +
									(this.__homeColumn > 1 ? tools.format("\u001B[~0~C", [this.__homeColumn - 1]) : '') // CursorRight X Times
								);
								this.flush();
								
								this.__column = this.__homeColumn;
								this.__row = this.__homeRow;
								this.__commandIndex = 0;
								
								ev.preventDefault();
								this._super(ev);
								
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.End)) {  // End
								const dims = this.calculateTextDims(this.__command);
								
								let rows = this.__homeRow + dims.rows;
								let columns = this.__homeColumn + dims.columns;
								
								if (columns > this.__columns) {
									rows += __Natives__.mathFloor(columns / this.__columns);
									columns = (columns % this.__columns);
								};
								
								this.write(	
									((this.__row > 0) && (rows > this.__row) ? tools.format("\u001B[~0~B", [rows - this.__row]) : '') + // CursorDown X Times
									nodejsTerminalAnsi.SimpleCommands.CursorHome +
									((columns > 1) ? tools.format("\u001B[~0~C", [columns - 1]) : '') // CursorRight X Times
								);
								this.flush();
								
								this.__column = columns;
								this.__row = rows;
								this.__commandIndex = this.__command.length;
								
								ev.preventDefault();
								this._super(ev);
								
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.LeftArrow)) {  // Left Arrow
								const chr = unicode.prevChar(this.__command, this.__commandIndex);
								if (chr) {
									if (this.__column <= 1) {
										if (this.__row > 1) {
											this.write(nodejsTerminalAnsi.SimpleCommands.CursorUp + nodejsTerminalAnsi.SimpleCommands.CursorEnd);
											this.__column = this.__columns;
											this.__row--;
										};
									} else {
										this.write(nodejsTerminalAnsi.SimpleCommands.CursorLeft);
										this.__column--;
									};
									this.__commandIndex -= chr.size;
									this.flush();
								};
								ev.preventDefault();
								this._super(ev);
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.RightArrow)) {  // Right Arrow
								const chr = unicode.nextChar(this.__command, this.__commandIndex);
								if (chr) {
									if (this.__column >= this.__columns) {
										this.write(nodejsTerminalAnsi.SimpleCommands.CursorDown + nodejsTerminalAnsi.SimpleCommands.CursorHome);
										this.__column = 1;
										this.__row++;
									} else {
										this.write(nodejsTerminalAnsi.SimpleCommands.CursorRight);
										this.__column++;
									};
									this.__commandIndex += chr.size;
									this.flush();
								};
								ev.preventDefault();
								this._super(ev);
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.UpArrow)) {  // Up Arrow
								if (this.__commandsHistory && !this.__questionMode) {
									if (this.__commandsHistoryIndex + 1 < this.__commandsHistory.length) {
										if ((this.__commandsHistoryIndex <= 0) && (this.__command)) {
											this.addCommandHistory(this.__command, (this.__commandsHistoryIndex === 0));
											this.__commandsHistoryIndex = 0;
										};
										this.write(	
											(this.__row > 1 ? tools.format("\u001B[~0~A", [this.__row - 1]) : '') + // CursorUp X Times
											nodejsTerminalAnsi.SimpleCommands.EraseBelow
										);
										this.flush();
										this.reset();
										this.printPrompt();
										this.__commandsHistoryIndex++;
										this.__command = this.__commandsHistory[this.__commandsHistoryIndex];
										this.__commandIndex = this.__command.length;
										this.writeText(this.__command);
										this.flush();
									};
								};
								ev.preventDefault();
								this._super(ev);
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.DownArrow)) {  // Down Arrow
								if (this.__commandsHistory && !this.__questionMode) {
									if ((this.__commandsHistoryIndex <= 0) && (this.__command)) {
										this.addCommandHistory(this.__command, (this.__commandsHistoryIndex === 0));
										this.__commandsHistoryIndex = 0;
									};
									this.write(	
										(this.__row > 1 ? tools.format("\u001B[~0~A", [this.__row - 1]) : '') + // CursorUp X Times
										nodejsTerminalAnsi.SimpleCommands.EraseBelow
									);
									this.flush();
									this.reset();
									this.printPrompt();
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
									this.flush();
								};
								ev.preventDefault();
								this._super(ev);
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.Insert)) {  // Insert
								this.__insertMode = !this.__insertMode;
								ev.preventDefault();
								this._super(ev);
							} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.Delete)) {  // Delete
								const chr = unicode.nextChar(this.__command, this.__commandIndex);
								if (chr) {
									const end = this.__command.slice(this.__commandIndex + chr.size);
									this.__command = this.__command.slice(0, this.__commandIndex) + end;
									this.__commandLen--;
									this.write(nodejsTerminalAnsi.SimpleCommands.SaveCursor + end + tools.repeat(nodejsTerminalAnsi.SimpleCommands.Erase, chr.size) + nodejsTerminalAnsi.SimpleCommands.RestoreCursor);
									this.flush();
								};
								ev.preventDefault();
								this._super(ev);
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
											this.write(nodejsTerminalAnsi.SimpleCommands.CursorUp);
										};
									};
									this.flush();
								};
								
								ev.preventDefault();
								this._super(ev);
							} else {
								this._super(ev);
							};
						};
					}),
				})));

				nodejsTerminalAnsi.REGISTER(nodejsTerminalAnsi.CommandPrompt.$extend(
				{
					$TYPE_NAME: 'Javascript',
					
					__globals: doodad.PROTECTED(  null  ),
					__preparedCommands: doodad.PROTECTED(  null  ),
					
					__commands: {
						help: function() {
							return types.get(this.options, 'help', "Help: Type Javascript expressions, or type `commands` to get a list of available commands.");
						},
						commands: function() {
							return types.keys(this.__preparedCommands);
						},
						globals: function() {
							return types.keys(this.__globals);
						},
					},
					
					
					create: doodad.OVERRIDE(function create(number, /*optional*/options) {
						const Promise = types.getPromise();

						this._super(number, options);
						
						const self = this,
							locals = types.get(options, 'locals', {root: root});

						const commands = types.extend({}, this.__commands, types.get(options, 'commands'));

						tools.forEach(commands, function(fn, name) {
							const val = function() {return val};
							val.inspect = function(/*paramarray*/) {
								let result = fn.call(self, arguments);
								if (types.isPromise(result)) {
									result = result
										.nodeify(new types.PromiseCallback(self, self.__printAsyncResult));
								};
								return result;
							};
							commands[name] = val;
						});
						
						this.__preparedCommands = commands;
						this.__globals = types.extend({}, locals, commands);
						
					}),
					
					__printAsyncResult: doodad.PROTECTED(function printAsyncResult(err, value) {
						let ansi;
						try {
							ansi = nodeUtil.inspect(err || value, {colors: !err});
						} catch(ex) {
							if (ex instanceof types.ScriptAbortedError) {
								throw ex;
							};
							err = true;
							ansi = nodeUtil.inspect(ex);
						};
						if (err) {
							this.consoleWrite('error', [ansi]);
						} else {
							this.consoleWrite('log', [ansi]);
						};
					}),
					
					runCommand: doodad.OVERRIDE(function runCommand(command, /*optional*/options) {
						const Promise = types.getPromise();
						command = tools.trim(command);
						if (!command) {
							return;
						};
						let result,
							failed = false;
						try {
							if (types.get(this.options, 'restricted', true)) {
								result = safeEval.eval(command, this.__globals);
							} else {
								result = safeEval.createEval(types.keys(this.__globals))
								result = result.apply(null, types.values(this.__globals));
								result = result(command);
							};
						} catch(ex) {
							if (ex instanceof types.ScriptAbortedError) {
								throw ex;
							};
							result = ex;
							failed = true;
						};
						let text;
						try {
							text = nodeUtil.inspect(result, {colors: !failed, customInspect: true});
						} catch(ex) {
							if (ex instanceof types.ScriptAbortedError) {
								throw ex;
							};
							failed = true;
							text = nodeUtil.inspect(ex);
						};
						if (failed) {
							this.write(nodejsTerminalAnsi.Colors.Red[0]);
						};
						this.writeLine();
						this.write(text);
						this.writeLine();
						if (failed) {
							this.write(nodejsTerminalAnsi.Colors.Normal[0]);
						};
						this.flush();
						if (types.isPromise(result)) {
							result
								.nodeify(new types.PromiseCallback(this, this.__printAsyncResult));
						};
					}),
					
				}));
				
				__Internal__.parseSettings = function parseSettings(err, data) {
					if (!err) {
						data = data.nodejsTerminal;
						nodejsTerminalAnsi.Keyboard = nodejsTerminalAnsi.computeKeyboard(data.keyboard);
						nodejsTerminalAnsi.NewLine = data.newLine;
						nodejsTerminalAnsi.Colors = data.colors;
						nodejsTerminalAnsi.EnterKey = data.enterKey;
						const cursorEnd = nodejsTerminalAnsi.SimpleCommands && nodejsTerminalAnsi.SimpleCommands.CursorEnd;
						nodejsTerminalAnsi.SimpleCommands = data.simpleCommands;
						if (cursorEnd) {
							nodejsTerminalAnsi.SimpleCommands.CursorEnd = cursorEnd;
						};
						return data;
					};
				};
				
				nodejsTerminal.loadSettings = function loadSettings(/*optional*/callback) {
					//return modules.locate('doodad-js-terminal').then(function (location) {
						const path = files.Path.parse(module.filename).set({file: ''}).combine('./res/nodejsTerminal.json', {os: 'linux'});
						//return config.loadFile(path, { async: true, watch: true, configPath: location, encoding: 'utf-8' }, [__Internal__.parseSettings, callback]);
						return config.loadFile(path, { async: true, watch: true, encoding: 'utf-8' }, [__Internal__.parseSettings, callback]);
					//});
				};

				
				return function init(/*optional*/options) {
					return nodejsTerminal.loadSettings();
				};
			},
		};
		
		return DD_MODULES;
	};
	
	//! BEGIN_REMOVE()
	if ((typeof process !== 'object') || (typeof module !== 'object')) {
	//! END_REMOVE()
		//! IF_UNDEF("serverSide")
			// <PRB> export/import are not yet supported in browsers
			global.DD_MODULES = exports.add(global.DD_MODULES);
		//! END_IF()
	//! BEGIN_REMOVE()
	};
	//! END_REMOVE()
}).call(
	//! BEGIN_REMOVE()
	(typeof window !== 'undefined') ? window : ((typeof global !== 'undefined') ? global : this)
	//! END_REMOVE()
	//! IF_DEF("serverSide")
	//! 	INJECT("global")
	//! ELSE()
	//! 	INJECT("window")
	//! END_IF()
);