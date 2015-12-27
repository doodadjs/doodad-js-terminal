//! REPLACE_BY("// Copyright 2015 Claude Petit, licensed under Apache License version 2.0\n")
// dOOdad - Class library for Javascript (BETA) with some extras (ALPHA)
// File: NodeJs_Terminal.js - NodeJs Terminal
// Project home: https://sourceforge.net/projects/doodad-js/
// Trunk: svn checkout svn://svn.code.sf.net/p/doodad-js/code/trunk doodad-js-code
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2015 Claude Petit
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
	var global = this;

	global.DD_MODULES = (global.DD_MODULES || {});
	global.DD_MODULES['Doodad.NodeJs.Terminal'] = {
		type: null,
		version: '0d',
		namespaces: ['Ansi'],
		dependencies: ['Doodad', 'Doodad.IO', 'Doodad.NodeJs', 'Doodad.NodeJs.IO'],
		
		create: function create(root, /*optional*/_options) {
			"use strict";

			const doodad = root.Doodad,
				types = doodad.Types,
				tools = doodad.Tools,
				namespaces = doodad.Namespaces,
				config = tools.Config,
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
			
			nodejsTerminalAnsi.parseKeys = function parseKeys(ansi, /*optional*/maxCount) {
				ansi = types.toString(ansi);
				const keys = [];
				let pos = 0;
				maxCount = (maxCount || Infinity);
				while (ansi && (keys.length < maxCount)) {
					const key = {
							text: null,
							charCode: 0,
							functionKeys: 0,
							scanCode: 0,
							raw: null,
						},
						keyboard = nodejsTerminalAnsi.Keyboard;
					let found = false;
					scanKeyboard: for (let name in keyboard) {
						if (types.hasKey(keyboard, name)) {
							const regEx = keyboard[name];
							regEx.lastIndex = 0;
							const match = regEx.exec(ansi);
							if (match) {
								let matchLen = match[0].length;
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
									let nextKey = nodejsTerminalAnsi.parseKeys(ansi.slice(1), 1);
									if (nextKey.length) {
										nextKey = nextKey[0];
										matchLen += nextKey.raw.length;
									} else {
										continue scanKeyboard;
									};
								};
								pos = matchLen;
								found = true;
								break;
							};
						};
					};
					if (!found) {
						const chr = ansi[0];
						if (chr === '\x1B') { // ESC
							key.text = null;
							key.scanCode = io.KeyboardScanCodes.Escape;
						} else {
							key.text = chr;
						};
						pos = 1;
					};
					key.charCode = (key.text ? key.text.charCodeAt(0) : 0);
					key.raw = ansi.slice(0, pos);
					keys.push(key);
					ansi = ansi.slice(pos);
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
			{
				$TYPE_NAME: 'Terminal',
				
				options: doodad.PUBLIC(doodad.READ_ONLY(null)),
				
				number: doodad.PUBLIC(doodad.READ_ONLY(null)),
				stdin: doodad.PUBLIC(doodad.READ_ONLY(null)),
				stdout: doodad.PUBLIC(doodad.READ_ONLY(null)),
				stderr: doodad.PUBLIC(doodad.READ_ONLY(null)),
				
				__column: doodad.PROTECTED(0),
				__row: doodad.PROTECTED(0),
				__columns: doodad.PROTECTED(0),
				__rows: doodad.PROTECTED(0),
				__lastColumn: doodad.PROTECTED(0),
				
				__savedColumn: doodad.PROTECTED(0),
				__savedRow: doodad.PROTECTED(0),
				
				__stdinBuffer: doodad.PROTECTED(null),
				__stdoutBuffer: doodad.PROTECTED(null),
				__stderrBuffer: doodad.PROTECTED(null),
				
				__onResizeCallback: doodad.PROTECTED(null),
				
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
					this.setAttributes(attrs);

					types.getDefault(options, 'writesLimit', 40)
					
					this.__stdinBuffer = [];
					this.__stdoutBuffer = [];
					this.__stderrBuffer = [];
					
					this.__onResizeCallback = new doodad.Callback(this, 'onResize');
					this.stdout.stream.on('resize', this.__onResizeCallback);
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
					if (this.__onResizeCallback) {
						this.stdout.stream.removeListener('resize', this.__onResizeCallback);
						this.__onResizeCallback = null;
					};
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
				
				listen: doodad.OVERRIDE(function listen(/*optional*/options) {
					this.stopListening();
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
				}),
				stopListening: doodad.OVERRIDE(function stopListening() {
					if (__Internal__.oldStdOut) {
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
					this.__savedColumn = this.__column;
					this.__savedRow = this.__row;
				}),
				restoreCursor: doodad.PUBLIC(function restoreCursor() {
					const column = this.__savedColumn,
						row = Math.min(this.__savedRow, this.__rows);
					
					//if (row === this.__rows) {
					//	column = Math.min(column, this.__lastColumn);
					//};
					
					const rows = this.__row - row;
					
					this.write(
						nodejsTerminalAnsi.SimpleCommands.CursorHome + 
						(column > 1 ? tools.format("\x1B[~0~C", [column - 1]) : '') +
						(rows >= 1 ? tools.format("\x1B[~0~A", [rows]) : (rows < 0 ? tools.format("\x1B[~0~B", [-rows]) : ''))
					);
					this.flush();
					
					this.__column = column;
					this.__row = row;
				}),
				resetPosition: doodad.PUBLIC(function resetPosition() {
					this.__column = 1;
					this.__row = 1;
					this.__rows = 0;
					this.__lastColumn = 1;
				}),
				
				refresh: doodad.PUBLIC(function refresh() {
					this.flush();
					this.resetPosition();
				}),
				
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
					const offset = types.get(options, 'offset', 0),
						count = types.get(options, 'count', 1);

					if (root.DD_ASSERT) {
						root.DD_ASSERT(types.isInteger(offset), "Invalid offset.");
						root.DD_ASSERT(types.isInteger(count), "Invalid count.");
					};

					if (types.get(options, 'preread', false)) {
						return this.__stdinBuffer.slice(offset, count);
					} else {
						return this.__stdinBuffer.splice(offset, count);
					};
				}),

				getCount: doodad.OVERRIDE(function getCount(/*optional*/options) {
					return this.__stdinBuffer.length;
				}),
				
				write: doodad.OVERRIDE(function write(ansi, /*optional*/options) {
					ansi = types.toString(ansi);
					
					const getBuffer = function getBuffer() {
						return ((this.stderr !== this.stdout) && types.get(options, 'isError', false) ? this.__stderrBuffer : this.__stdoutBuffer);
					};
					
					const buffer = getBuffer.apply(this);
					
					let write = function write() {
						const ev = new doodad.Event({
							raw: ansi,
							options: options,
						});
						this.onWrite(ev);
						ansi = ev.data.raw;
						buffer.push(ansi);
					};

					const bufferSize = this.options.bufferSize;
					if (buffer.length < bufferSize) {
						write.apply(this);
						write = null;
					};
					if (buffer.length >= bufferSize) {
						if (this.options.autoFlush) {
							this.flush(options);
							if (getBuffer.apply(this).length > bufferSize) {
								throw new types.BufferOverflow();
							} else {
								write && write.apply(this);
							};
						} else {
							throw new types.BufferOverflow();
						};
					};
				}),
				
				writeText: doodad.REPLACE(function writeText(text, /*optional*/options) {
					text = nodejsTerminalAnsi.toText(text);
					
					const screenColumns = this.__columns,
						lines = text.split(nodejsTerminalAnsi.NewLine),
						linesLen = lines.length;
						
					let columns = 0,
						rows;
						
					for (let i = 0; i < linesLen; i++) {
						const line = lines[i],
							lineLen = line.length;
						
						rows = Math.floor(lineLen / screenColumns);
						columns = (lineLen % screenColumns);

						if (i > 0) {
							rows++;
							this.__column = 1;
						};
						
						this.__row += rows;
					};
					
					this.__column += columns;
					
					if (this.__column > screenColumns) {
						this.__row += Math.floor(this.__column / screenColumns);
						this.__column = (this.__column % screenColumns);
					};
					
					this.__rows = Math.max(this.__row, this.__rows);

					if (this.__row === this.__rows) {
						this.__lastColumn = this.__column;
					};
					
					this.write(text, options);
				}),

				flush: doodad.OVERRIDE(function flush(/*optional*/options) {
					//function __flush(stream, buffer, /*optional*/callback) {
					//	if (buffer.length) {
					//		stream.write(buffer.shift(), types.extend({}, options, {callback: new doodad.Callback(this, function() {
					//			__flush(stream, buffer, callback);
					//		})}));
					//	} else {
					//		callback && callback();
					//	};
					//};
					//__flush(this.stdout, this.__stdoutBuffer, new doodad.Callback(this, function() {
					//	__flush(this.stderr, this.__stderrBuffer);
					//}));
					function __flush(stream, buffer, /*optional*/callback) {
						let ansi = '';
						while (buffer.length) {
							ansi += buffer.shift();
						};
						stream.write(ansi, types.extend({}, options, {callback: callback}));
					};
					__flush(this.stdout, this.__stdoutBuffer, new doodad.Callback(this, function() {
						__flush(this.stderr, this.__stderrBuffer);
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
						// TODO: See if nodejs as a "format" function for that
						const template = (args[0] + '');
						let msg = '',
							pos = 1,
							isPercent = false,
							start = 0,
							end = 0;
						while (end < template.length) {
							const chr = template[end];
							if (chr === '%') {
								if (isPercent) {
									msg += '%';
									isPercent = false;
								} else {
									isPercent = true;
								};
							} else if (isPercent) {
								const arg = args[pos++];
								msg += template.slice(start, end - 1) + (types.isNothing(arg) ? '' : arg.toString());
								start = end + 1;
								isPercent = false;
							};
							end++;
						};
						if (start < template.length) {
							msg += template.slice(start);
						};
						
						
						this.__consoleWritesCount[writesName]++;
						
						this.saveCursor();
						this.write(	
									(this.__row > 1 ? tools.format("\u001B[~0~A", [this.__row - 1]) : '') + // CursorUp X times
									nodejsTerminalAnsi.SimpleCommands.EraseLine + 
									nodejsTerminalAnsi.SimpleCommands.EraseBelow + 
									nodejsTerminalAnsi.SimpleCommands.CursorHome
						);
						options = types.extend({}, this.options, options);
						const color = nodejsTerminalAnsi.Colors[types.get(options, name + 'Color', null)];
						if (color) {
							this.write(color[0], options);
						} else {
							this.write(nodejsTerminalAnsi.Colors.Normal[0], options);
						};
						const bgColor = nodejsTerminalAnsi.Colors[types.get(options, name + 'BgColor', null)];
						if (bgColor) {
							this.write(bgColor[1], options);
						} else {
							this.write(nodejsTerminalAnsi.Colors.Normal[1], options);
						};
						if (name === 'log') {
							this.writeLine(msg, options);
						} else if (name === 'warn') {
							options.isError = true;
							this.writeLine(msg, options);
						} else if (name === 'error') {
							options.isError = true;
							this.writeLine(msg, options);
						} else if (name === 'info') {
							options.isError = true;
							this.writeLine(msg, options);
						} else {
							this.writeLine(msg, options);
						};
						if (color) {
							this.write(nodejsTerminalAnsi.Colors.Normal[0], options);
						};
						if (bgColor) {
							this.write(nodejsTerminalAnsi.Colors.Normal[1], options);
						};
						this.flush();
						this.refresh();
						this.restoreCursor();
						
						return msg;
					};
				}),
				
				setColumns: doodad.PROTECTED(function setColumns() {
					const newColumns = this.stdout.stream.columns;
					this.__columns = newColumns;
					nodejsTerminalAnsi.SimpleCommands.CursorEnd = '\x1B[' + newColumns + 'G';
				}),
/*
				onResize: doodad.PROTECTED(function onResize() {
					const newColumns = this.stdout.stream.columns;
					if (tools.getOS().type === 'windows') {
						//this.__column = ((((this.__row - 1) * this.__columns) + this.__column) % newColumns);
						//if (this.__column === 0) {
						//	this.__column = newColumns;
						//};
						//this.__row = -Math.floor(-(((this.__row - 1) * this.__columns) + (this.__row === this.__rows ? this.__lastColumn : this.__columns)) / newColumns);
						//if (this.__row <= 0) {
						//	this.__row = 1;
						//};
						const prevRows = this.__rows;
						this.__rows = -Math.floor(-(((prevRows - 1) * this.__columns) + this.__lastColumn) / newColumns);
						if (this.__rows <= 0) {
							this.__rows = 1;
						};
						if (this.__lastColumn) {
							this.__lastColumn = ((((prevRows - 1) * this.__columns) + this.__lastColumn) % newColumns);
							if (this.__lastColumn <= 0) {
								this.__lastColumn = newColumns;
							};
						};
						this.setColumns();
						// Windows automatically moves cursor at the end
						this.__column = this.__lastColumn;
						this.__row = this.__rows;
					};
				}),
*/
				onResize: doodad.PROTECTED(function onResize() {
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
				exception: doodad.OVERRIDE(ioInterfaces.IConsole, function exception(raw, /*optional*/options) {
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
				__commandIndex: doodad.PROTECTED(0),
				__insertMode: doodad.PROTECTED(false),
				__homeColumn: doodad.PROTECTED(1),
				
				__savedHomeColumn: doodad.PROTECTED(1),
				__savedCommandIndex: doodad.PROTECTED(0),
				
				__questionMode: doodad.PROTECTED(false),
				__question: doodad.PROTECTED(null),
				__questionCallback: doodad.PROTECTED(null),
				__questionOptions: doodad.PROTECTED(null),
				
				// <PRB> Since ?????, the cursor behaves differently
				__linuxPatch: doodad.PROTECTED(2),
				
				printPrompt: doodad.PROTECTED(function printPrompt() {
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
				}),
				
				runCommand: doodad.PROTECTED(doodad.MUST_OVERRIDE()), //function runCommand(command, /*optional*/options)
				
				listen: doodad.OVERRIDE(function listen(/*optional*/options) {
					this._super(options);
					
					this.printPrompt();
				}),

				saveCursor: doodad.OVERRIDE(function saveCursor() {
					this._super();
					this.__savedHomeColumn = this.__homeColumn;
					this.__savedCommandIndex = this.__commandIndex;
				}),
				restoreCursor: doodad.OVERRIDE(function restoreCursor() {
					this.__savedColumn += this.__homeColumn - this.__savedHomeColumn;
					const sign = tools.sign(this.__savedColumn);
					this.__savedColumn = Math.abs(this.__savedColumn);
					if (sign <= 0) {
						this.__savedColumn++;
					};
					if (this.__savedColumn > this.__columns) {
						this.__savedRow += Math.sign(this.__savedColumn) * Math.floor(this.__savedColumn / this.__columns);
						this.__savedColumn = this.__savedColumn % this.__columns;
					};
					this._super();
					this.__commandIndex = Math.min(this.__savedCommandIndex, this.__command.length);
				}),
				resetPosition: doodad.OVERRIDE(function resetPosition() {
					this._super();
					
					this.__homeColumn = 1;
					this.__commandIndex = 0;
				}),
				
				reset: doodad.OVERRIDE(function reset() {
					this._super();

					this.__command = '';
					this.__insertMode = false;
					this.__questionMode = false;
					this.__question = '';
					this.__questionCallback = null;
					this.__questionOptions = null;
					
					this.__linuxPatch = 2;
				}),

				clear: doodad.OVERRIDE(function clear() {
					this._super();

					this.__command = '';
				}),
				
				refresh: doodad.OVERRIDE(function refresh() {
					this.writeLine();

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

				//onResize: doodad.OVERRIDE(function onResize() {
				//	// TODO: Fix bug on Windows with "Home" and "End" erasing screen
				//	
				//	this._super();
				//	
				//	if (__Internal__.osType === 'windows') {
				//		const len = this.__homeColumn + this.__command.length;
				//		this.__lastColumn = len - (Math.floor(len / this.__columns) * this.__columns);
				//		if (this.__lastColumn <= 0) {
				//			this.__lastColumn = this.__columns;
				//		};
				//		// Windows automatically moves cursor at the end
				//		this.__column = this.__lastColumn;
				//		this.__commandIndex = this.__command.length;
				//	};
				//}),
				
				onReady: doodad.OVERRIDE(function onReady(ev) {
					// TODO: Command history
					// TODO: Auto-completion
					// TODO: Hints
					if (ev.prevent) {
						this._super(ev);
					} else {
						const data = ev.data;
						if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'M')) { // Enter
							const command = this.__command;
							if (this.__questionMode) {
								const qcb = this.__questionCallback;
								this.writeLine();
								this.flush();
								this.reset();
								if (qcb) {
									qcb(command);
								};
							} else if (command) {
								this.runCommand(command);
							};
							this._super(ev);
							this.reset();
							this.printPrompt();
						} else if ((data.functionKeys === io.KeyboardFunctionKeys.Ctrl) && (data.text === 'H')) { // Backspace
							if (this.__commandIndex > 0) {
								this.__commandIndex--;
								const end = this.__command.slice(this.__commandIndex + 1);
								this.__command = this.__command.slice(0, this.__commandIndex) + end;
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
							this.write(	
								(this.__row > 1 ? tools.format("\u001B[~0~A", [this.__row - 1]) : '') + // CursorUp X Times
								nodejsTerminalAnsi.SimpleCommands.CursorHome +
								(this.__homeColumn > 1 ? tools.format("\u001B[~0~C", [this.__homeColumn - 1]) : '') // CursorRight X Times
							);
							this.flush();
							this.__column = this.__homeColumn;
							this.__row = 1;
							this.__commandIndex = 0;
							ev.preventDefault();
							this._super(ev);
						} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.End)) {  // End
							this.write(	
								(this.__row > 0 && this.__rows > this.__row ? tools.format("\u001B[~0~B", [this.__rows - this.__row]) : '') + // CursorDown X Times
								nodejsTerminalAnsi.SimpleCommands.CursorHome +
								(this.__lastColumn > 1 ? tools.format("\u001B[~0~C", [this.__lastColumn - 1]) : '') // CursorRight X Times
							);
							this.flush();
							this.__column = this.__lastColumn;
							this.__row = this.__rows;
							this.__commandIndex = this.__command.length;
							ev.preventDefault();
							this._super(ev);
						} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.LeftArrow)) {  // Left Arrow
							if (this.__commandIndex > 0) {
								if (this.__column <= 1) {
									if (this.__row > 1) {
										this.write(nodejsTerminalAnsi.SimpleCommands.CursorUp + nodejsTerminalAnsi.SimpleCommands.CursorEnd);
										this.flush();
										this.__column = this.__columns;
										this.__row--;
									};
								} else {
									this.write(nodejsTerminalAnsi.SimpleCommands.CursorLeft);
									this.flush();
									this.__column--;
								};
								this.__commandIndex--;
							};
							ev.preventDefault();
							this._super(ev);
						} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.RightArrow)) {  // Right Arrow
							if (this.__commandIndex < this.__command.length) {
								if (this.__column >= this.__columns) {
									if (this.__row < this.__rows) {
										this.write(nodejsTerminalAnsi.SimpleCommands.CursorDown + nodejsTerminalAnsi.SimpleCommands.CursorHome);
										this.flush();
										this.__column = 1;
										this.__row++;
									};
								} else {
									this.write(nodejsTerminalAnsi.SimpleCommands.CursorRight);
									this.flush();
									this.__column++;
								};
								this.__commandIndex++;
							};
							ev.preventDefault();
							this._super(ev);
						} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.Insert)) {  // Insert
							this.__insertMode = !this.__insertMode;
							ev.preventDefault();
							this._super(ev);
						} else if (!data.functionKeys && (data.scanCode === io.KeyboardScanCodes.Delete)) {  // Delete
							if (this.__commandIndex < this.__command.length) {
								const end = this.__command.slice(this.__commandIndex + 1);
								this.__command = this.__command.slice(0, this.__commandIndex) + end;
								this.write(nodejsTerminalAnsi.SimpleCommands.SaveCursor + end + nodejsTerminalAnsi.SimpleCommands.Erase + nodejsTerminalAnsi.SimpleCommands.RestoreCursor);
								this.flush();
							};
							ev.preventDefault();
							this._super(ev);
						} else if (!data.functionKeys && data.text) {  // Visible chars
							const end = this.__command.slice(this.__commandIndex + (this.__insertMode ? 0 : 1)),
								newCommand = this.__command.slice(0, this.__commandIndex) + data.text + end;
							if (newCommand.length <= types.get(this.options, 'maxCommandLength', 1024)) {
								this.__command = newCommand;
								this.__commandIndex++;
								this.writeText(data.text);
								const row = this.__row,
									column = this.__column;
								if (end) {
									this.write(nodejsTerminalAnsi.SimpleCommands.SaveCursor);
									this.writeText(end);
									this.write(nodejsTerminalAnsi.SimpleCommands.RestoreCursor);
									// <PRB> Since ?????, the cursor behaves differently, both on Windows and Linux
									if (__Internal__.osType === 'windows') {
										if (((column + end.length) % this.__columns) === 1) {
											this.write(nodejsTerminalAnsi.SimpleCommands.CursorUp);
										};
									} else {
										if (column < this.__columns) {
											if (((column + end.length) % this.__columns) === this.__linuxPatch) {
												this.write(nodejsTerminalAnsi.SimpleCommands.CursorUp);
												this.__linuxPatch = 1;
											};
										} else {
											this.write(nodejsTerminalAnsi.SimpleCommands.CursorDown + nodejsTerminalAnsi.SimpleCommands.CursorHome);
										};
									};
								};
								this.flush();
								this.__row = row;
								this.__column = column;
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
				
				__locals: doodad.PROTECTED(  null  ),
				
				create: doodad.OVERRIDE(function create(number, /*optional*/options) {
					this._super(number, options);
					
					const self = this;

					const locals = types.get(options, 'locals', {root: root});

					const commands = types.extend({}, types.get(options, 'commands'), {
						help: function() {
							return types.get(self.options, 'help', "Help: Type Javascript expressions.");
						},
						quit: function() {
							tools.abortScript();
						},
						exit: function() {
							tools.abortScript();
						},
						commands: function() {
							return types.keys(commands);
						},
						globals: function() {
							return types.keys(self.__locals);
						},
					})

					tools.forEach(commands, function(fn, name) {
						const val = function() {return val};
						val.inspect = fn;
						commands[name] = val;
					});
					
					this.__locals = types.extend({}, locals, commands);
				}),
				
				runCommand: doodad.OVERRIDE(function runCommand(command, /*optional*/options) {
					let result,
						failed = false;
					try {
						if (types.get(this.options, 'restricted', true)) {
							result = tools.safeEval(command, this.__locals);
						} else {
							result = tools.safeEval.createEval(types.keys(this.__locals))
							result = result.apply(null, types.values(this.__locals));
							result = result(command);
						};
					} catch(ex) {
						if (ex instanceof types.ScriptAbortedError) {
							throw ex;
						};
						result = ex;
						failed = true;
					};
					try {
						result = nodeUtil.inspect(result, {colors: !failed, customInspect: true});
					} catch(ex) {
						failed = true;
						result = nodeUtil.inspect(ex);
					};
					if (failed) {
						this.write(nodejsTerminalAnsi.Colors.Red[0]);
					};
					this.writeLine(undefined, options);
					this.write(result, options);
					this.writeLine(undefined, options);
					if (failed) {
						this.write(nodejsTerminalAnsi.Colors.Normal[0]);
					};
					this.flush();
				}),
				
			}));
			
			__Internal__.parseSettings = function parseSettings(data) {
				if (!types.isError(data)) {
					data = data.nodejsTerminal;
					nodejsTerminalAnsi.Keyboard = nodejsTerminalAnsi.computeKeyboard(data.keyboard);
					nodejsTerminalAnsi.NewLine = data.newLine;
					nodejsTerminalAnsi.Colors = data.colors;
					const cursorEnd = nodejsTerminalAnsi.SimpleCommands && nodejsTerminalAnsi.SimpleCommands.CursorEnd;
					nodejsTerminalAnsi.SimpleCommands = data.simpleCommands;
					if (cursorEnd) {
						nodejsTerminalAnsi.SimpleCommands.CursorEnd = cursorEnd;
					};
					return data;
				};
			};
			
			nodejsTerminal.loadSettings = function loadSettings(/*optional*/callback) {
				const configPath = tools.Path.parse(module.filename),
					path = tools.options.hooks.pathParser('./res/nodejsTerminal.json');
				return config.loadFile(path, {async: true, watch: true, configPath: configPath, encoding: 'utf8'}, [__Internal__.parseSettings, callback]);
			};

			
			return function init(/*optional*/options) {
				nodejsTerminal.loadSettings()
					['finally'](new namespaces.ReadyCallback());
			};
		},
	};
})();