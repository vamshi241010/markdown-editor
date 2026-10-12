import React, { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import { Search, ChevronDown, ChevronUp, X, CaseSensitive, WholeWord } from "lucide-react";

export default function Editor({
  yDoc,
  users,
  currentUserId,
  onCursorChange,
  onContentChange,
  onSave,
  readOnly = false,
  theme = "vs"
}) {
  const [editor, setEditor] = useState(null);
  const [monaco, setMonaco] = useState(null);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  
  // Custom Search & Replace Panel State
  const [showSearch, setShowSearch] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matches, setMatches] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Search & Cursor references
  const findInputRef = useRef(null);
  const searchDecorationsRef = useRef([]);
  const decorationIdsRef = useRef([]);
  const isRemoteChange = useRef(false);

  const yText = yDoc.getText("markdown");

  // 1. Monaco Editor Mounted
  const handleEditorDidMount = (editorInstance, monacoInstance) => {
    setEditor(editorInstance);
    setMonaco(monacoInstance);
    
    const model = editorInstance.getModel();
    if (!model) return;

    // Set initial text
    isRemoteChange.current = true;
    model.setValue(yText.toString());
    isRemoteChange.current = false;

    // A. Sync: LOCAL EDIT -> YJS Text Updates
    const disposable = editorInstance.onDidChangeModelContent((event) => {
      const currentVal = model.getValue();
      if (onContentChange) {
        onContentChange(currentVal);
      }

      if (isRemoteChange.current) return;

      isRemoteChange.current = true;
      try {
        yDoc.transact(() => {
          // Process changes in reverse order so preceding offsets remain unaffected
          const reversedChanges = [...event.changes].reverse();
          reversedChanges.forEach((change) => {
            const index = change.rangeOffset;
            const length = change.rangeLength;
            
            if (length > 0) {
              yText.delete(index, length);
            }
            if (change.text) {
              yText.insert(index, change.text);
            }
          });
        });
      } catch (err) {
        console.error("Error applying changes to YJS:", err);
      } finally {
        isRemoteChange.current = false;
      }
    });

    // B. Sync: REMOTE EDIT (from YJS) -> Monaco Model
    const observeYtext = (event) => {
      if (isRemoteChange.current) return;

      isRemoteChange.current = true;
      try {
        model.pushStackElement(); // clean undo/redo stack checkpoint
        
        let index = 0;
        event.delta.forEach((op) => {
          if (op.retain) {
            index += op.retain;
          } else if (op.insert) {
            const startPos = model.getPositionAt(index);
            model.pushEditOperations(
              [],
              [{
                range: new monacoInstance.Range(startPos.lineNumber, startPos.column, startPos.lineNumber, startPos.column),
                text: op.insert,
                forceMoveMarkers: true
              }],
              () => null
            );
            index += op.insert.length;
          } else if (op.delete) {
            const startPos = model.getPositionAt(index);
            const endPos = model.getPositionAt(index + op.delete);
            model.pushEditOperations(
              [],
              [{
                range: new monacoInstance.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
                text: "",
                forceMoveMarkers: true
              }],
              () => null
            );
          }
        });
      } catch (err) {
        console.error("Error applying remote YJS update to Monaco:", err);
      } finally {
        isRemoteChange.current = false;
      }

      if (onContentChange) {
        onContentChange(yText.toString());
      }
    };

    yText.observe(observeYtext);

    // C. Cursor selection listener
    const selectionDisposable = editorInstance.onDidChangeCursorPosition((event) => {
      onCursorChange({
        line: event.position.lineNumber,
        column: event.position.column
      });
    });

    // D. Register Keyboard shortcuts for our custom Search and Replace
    editorInstance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyF, () => {
      setShowSearch((prev) => !prev);
    });

    editorInstance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyH, () => {
      setShowSearch(true);
    });

    // E. Register Bold, Italic, and Save keyboard shortcuts
    const toggleFormat = (syntax) => {
      const selection = editorInstance.getSelection();
      const model = editorInstance.getModel();
      if (!selection || !model) return;

      const selectedText = model.getValueInRange(selection);
      let newText = "";

      if (selection.isEmpty()) {
        newText = syntax + syntax;
        const position = selection.getStartPosition();
        
        editorInstance.executeEdits("format", [
          {
            range: selection,
            text: newText,
            forceMoveMarkers: true
          }
        ]);

        const newColumn = position.column + syntax.length;
        editorInstance.setPosition({
          lineNumber: position.lineNumber,
          column: newColumn
        });
      } else {
        const len = syntax.length;
        const isWrapped = selectedText.startsWith(syntax) && selectedText.endsWith(syntax);

        if (isWrapped) {
          newText = selectedText.substring(len, selectedText.length - len);
        } else {
          newText = syntax + selectedText + syntax;
        }

        editorInstance.executeEdits("format", [
          {
            range: selection,
            text: newText,
            forceMoveMarkers: true
          }
        ]);

        const startPos = selection.getStartPosition();
        const lines = newText.split("\n");
        const lineCount = lines.length - 1;
        const lastLineLength = lines[lines.length - 1].length;

        const endLineNumber = startPos.lineNumber + lineCount;
        const endColumn = lineCount === 0 
          ? startPos.column + newText.length 
          : lastLineLength + 1;

        editorInstance.setSelection(new monacoInstance.Selection(
          startPos.lineNumber,
          startPos.column,
          endLineNumber,
          endColumn
        ));
      }
      editorInstance.focus();
    };

    editorInstance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyB, () => {
      toggleFormat("**");
    });

    editorInstance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyI, () => {
      toggleFormat("*");
    });

    editorInstance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      if (onSaveRef.current) {
        onSaveRef.current();
      }
    });

    // Cleanup binds
    editorInstance.onDidDispose(() => {
      disposable.dispose();
      selectionDisposable.dispose();
      yText.unobserve(observeYtext);
    });
  };

  // 1a. Pre-populate Find Input with currently selected editor text when Search opens
  useEffect(() => {
    if (showSearch && editor) {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText = editor.getModel().getValueInRange(selection);
        if (selectedText && selectedText.length < 100) {
          setFindText(selectedText);
        }
      }
    }
  }, [showSearch, editor]);

  // 1b. Monitor / Recalculate Find Matches in real-time
  useEffect(() => {
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const findMatches = () => {
      if (!showSearch || !findText) {
        setMatches([]);
        setActiveIndex(-1);
        return;
      }

      try {
        let searchString = findText;
        let isRegexSearch = useRegex;
        if (wholeWord && !useRegex) {
          const escaped = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          searchString = `\\b${escaped}\\b`;
          isRegexSearch = true;
        }

        const found = model.findMatches(searchString, false, isRegexSearch, matchCase, null, true, 2000);
        setMatches(found);
        
        setActiveIndex((prev) => {
          if (found.length === 0) return -1;
          if (prev >= found.length || prev === -1) return 0;
          return prev;
        });
      } catch (e) {
        console.warn("Regex parse error:", e);
      }
    };

    findMatches();

    const disposable = editor.onDidChangeModelContent(() => {
      findMatches();
    });

    return () => {
      disposable.dispose();
    };
  }, [editor, monaco, findText, matchCase, wholeWord, useRegex, showSearch]);

  // 1c. Update Search Highlights (Decorations) & Scroll to Active Selection
  useEffect(() => {
    if (!editor || !monaco) return;

    if (!showSearch || matches.length === 0) {
      searchDecorationsRef.current = editor.deltaDecorations(searchDecorationsRef.current, []);
      return;
    }

    const newDecorations = matches.map((match, idx) => {
      const isActive = idx === activeIndex;
      return {
        range: match.range,
        options: {
          className: isActive
            ? theme === "vs-dark"
              ? "bg-amber-400/50 border border-amber-300 text-white font-semibold"
              : "bg-amber-400/60 border border-amber-600 text-zinc-950 font-semibold"
            : theme === "vs-dark"
            ? "bg-zinc-700/50 border border-zinc-650"
            : "bg-amber-100/80 border border-amber-200/50 text-zinc-900",
          overviewRuler: {
            color: isActive ? "#F59E0B" : "#FBBF24",
            position: 4
          }
        }
      };
    });

    searchDecorationsRef.current = editor.deltaDecorations(searchDecorationsRef.current, newDecorations);

    // Focus / Scroll active item
    if (activeIndex >= 0 && activeIndex < matches.length) {
      const activeRange = matches[activeIndex].range;
      editor.revealRangeInCenterIfOutsideViewport(activeRange);
    }
  }, [editor, monaco, matches, activeIndex, showSearch, theme]);

  // 1d. Clean Search Decorations on close/unmount
  useEffect(() => {
    return () => {
      if (editor && searchDecorationsRef.current.length > 0) {
        editor.deltaDecorations(searchDecorationsRef.current, []);
      }
    };
  }, [editor]);

  // 1e. Search Panel action operators: prev, next, replace, replaceAll
  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (activeIndex + 1) % matches.length;
    setActiveIndex(nextIdx);
    
    const activeRange = matches[nextIdx].range;
    editor.revealRangeInCenterIfOutsideViewport(activeRange);
    editor.setSelection(activeRange);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIdx = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(prevIdx);

    const activeRange = matches[prevIdx].range;
    editor.revealRangeInCenterIfOutsideViewport(activeRange);
    editor.setSelection(activeRange);
  };

  const handleReplace = () => {
    if (!editor || activeIndex < 0 || activeIndex >= matches.length) return;
    const model = editor.getModel();
    if (!model) return;

    const activeMatch = matches[activeIndex];
    const range = activeMatch.range;

    editor.executeEdits("search-replace", [
      {
        range: range,
        text: replaceText,
        forceMoveMarkers: true
      }
    ]);

    editor.focus();
  };

  const handleReplaceAll = () => {
    if (!editor || matches.length === 0) return;
    const model = editor.getModel();
    if (!model) return;

    const edits = [...matches].reverse().map((match) => ({
      range: match.range,
      text: replaceText,
      forceMoveMarkers: true
    }));

    editor.executeEdits("search-replace-all", edits);
    editor.focus();
  };

  // Focus Find Textbox on toggle
  useEffect(() => {
    if (showSearch && findInputRef.current) {
      findInputRef.current.focus();
    }
  }, [showSearch]);

  // 2. Render Remote Collaborative Cursors using Decoration API
  useEffect(() => {
    if (!editor || !monaco) return;

    const newDecorations = [];
    
    users.forEach((user) => {
      if (user.id === currentUserId || !user.cursor) return;

      const model = editor.getModel();
      if (!model) return;

      const lineCount = model.getLineCount();
      const line = Math.min(user.cursor.line, lineCount);
      const lineMaxCol = model.getLineMaxColumn(line);
      const column = Math.min(user.cursor.column, lineMaxCol);

      newDecorations.push({
        range: new monaco.Range(line, column, line, column + 1),
        options: {
          className: `remote-cursor-${user.id}`,
          beforeContentClassName: `remote-cursor-label-${user.userId}`,
          hoverMessage: { value: user.username }
        }
      });
    });

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );
  }, [users, editor, monaco, currentUserId]);

  // Clean elements on unmount
  useEffect(() => {
    return () => {
      if (editor && decorationIdsRef.current.length > 0) {
        editor.deltaDecorations(decorationIdsRef.current, []);
      }
    };
  }, [editor]);

  // Generate dynamic classes inside CSS block for other collaborator cursors
  const styleTags = users
    .filter((u) => u.userId !== currentUserId && u.cursor)
    .map((u) => {
      return `
        .remote-cursor-${u.userId} {
          border-left: 2px solid ${u.color} !important;
          animation: blink 1s infinite;
        }
        .remote-cursor-label-${u.userId}::before {
          content: '${u.username.replace(/'/g, "\\'")}';
          position: absolute;
          top: -14px;
          left: 0;
          background-color: ${u.color};
          color: white;
          font-size: 9px;
          font-family: system-ui, sans-serif;
          font-weight: 500;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 100;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          line-height: 1;
        }
      `;
    })
    .join("\n");

  return (
    <div className="w-full h-full flex flex-col relative" id="monaco-editor-host">
      {/* Dynamic Cursor Styles */}
      <style>{`
        ${styleTags}
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* Editor custom operations bar */}
      <div className={`px-3 py-1.5 border-b flex items-center justify-between font-sans text-xs select-none ${
        theme === "vs-dark" ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-600"
      }`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 font-semibold text-xs cursor-pointer select-none border ${
              showSearch 
                ? "bg-indigo-600 text-white border-indigo-650 hover:bg-indigo-700" 
                : theme === "vs-dark" 
                ? "border-zinc-805 bg-zinc-90 w bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100" 
                : "border-zinc-250 bg-white hover:bg-zinc-100 hover:text-zinc-900"
            }`}
            title="Toggle Search and Replace widget (Ctrl+F)"
            id="editor-btn-find-replace"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search & Replace</span>
          </button>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span>Ln {editor ? editor.getPosition()?.lineNumber || 1 : 1}, Col {editor ? editor.getPosition()?.column || 1 : 1}</span>
          <span className="hidden sm:inline bg-zinc-800/5 dark:bg-zinc-100/10 px-1.5 py-0.5 rounded font-sans">Markdown mode</span>
        </div>
      </div>

      {/* Custom Search & Replace Panel */}
      {showSearch && (
        <div 
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowSearch(false);
              if (editor) editor.focus();
            }
          }}
          className={`p-3 border-b flex flex-col gap-2 font-sans transition-all animate-fade-in ${
            theme === "vs-dark" ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-zinc-50 border-zinc-250 text-zinc-705"
          }`} 
          id="editor-search-replace-bar"
        >
          {/* Find Row */}
          <div className="flex flex-wrap items-center gap-3 bg-zinc-950/15 dark:bg-zinc-100/5 p-2 rounded-lg">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <input
                ref={findInputRef}
                type="text"
                placeholder="Find text..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.shiftKey) {
                      handlePrev();
                    } else {
                      handleNext();
                    }
                  }
                }}
                className={`flex-1 px-2.5 py-1 text-xs border rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-505 font-sans ${
                  theme === "vs-dark" ? "bg-zinc-950 border-zinc-850 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500" : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500"
                }`}
                id="search-find-input"
              />
            </div>

            {/* Counter */}
            <div className="text-[11px] font-mono px-2 py-1 bg-zinc-800/10 dark:bg-zinc-100/10 rounded min-w-[55px] text-center select-none shrink-0">
              {matches.length > 0 ? `${activeIndex + 1}/${matches.length}` : "0/0"}
            </div>

            {/* Shift controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handlePrev}
                disabled={matches.length === 0}
                className={`p-1 border rounded transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none hover:bg-zinc-800/10 dark:hover:bg-zinc-100/10 ${
                  theme === "vs-dark" ? "border-zinc-800 text-zinc-300" : "border-zinc-300 text-zinc-700"
                }`}
                title="Previous Match (Shift+Enter)"
                id="find-prev-btn"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNext}
                disabled={matches.length === 0}
                className={`p-1 border rounded transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none hover:bg-zinc-800/10 dark:hover:bg-zinc-100/10 ${
                  theme === "vs-dark" ? "border-zinc-800 text-zinc-300" : "border-zinc-300 text-zinc-700"
                }`}
                title="Next Match (Enter)"
                id="find-next-btn"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Option toggles */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setMatchCase(prev => !prev)}
                className={`px-2 py-0.5 border rounded text-[10px] font-bold transition-all cursor-pointer select-none font-sans flex items-center gap-1 ${
                  matchCase
                    ? "bg-indigo-600 text-white border-indigo-650"
                    : theme === "vs-dark" ? "border-zinc-800 bg-zinc-900 text-zinc-450 hover:bg-zinc-800" : "border-zinc-300 bg-white text-zinc-650 hover:bg-zinc-100"
                }`}
                title="Match Case (Case Sensitive)"
                id="find-case-toggle"
              >
                <CaseSensitive className="w-3.5 h-3.5" />
                <span>Aa</span>
              </button>
              <button
                onClick={() => setWholeWord(prev => !prev)}
                className={`px-2 py-0.5 border rounded text-[10px] font-bold transition-all cursor-pointer select-none font-sans flex items-center gap-1 ${
                  wholeWord
                    ? "bg-indigo-600 text-white border-indigo-650"
                    : theme === "vs-dark" ? "border-zinc-800 bg-zinc-900 text-zinc-450 hover:bg-zinc-800" : "border-zinc-300 bg-white text-zinc-650 hover:bg-zinc-100"
                }`}
                title="Match Whole Word"
                id="find-whole-word-toggle"
              >
                <WholeWord className="w-3.5 h-3.5" />
                <span>[ab]</span>
              </button>
              <button
                onClick={() => setUseRegex(prev => !prev)}
                className={`px-2 py-0.5 border rounded text-[10px] font-bold transition-all cursor-pointer select-none font-sans flex items-center gap-1 ${
                  useRegex
                    ? "bg-indigo-600 text-white border-indigo-650"
                    : theme === "vs-dark" ? "border-zinc-800 bg-zinc-900 text-zinc-450 hover:bg-zinc-800" : "border-zinc-300 bg-white text-zinc-650 hover:bg-zinc-100"
                }`}
                title="Use Regular Expression (Regex)"
                id="find-regex-toggle"
              >
                <span className="font-mono text-[9px] mr-0.5">.*</span>
                <span>Regex</span>
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={() => {
                setShowSearch(false);
                setFindText("");
              }}
              className={`p-1 border rounded transition-all cursor-pointer hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-955/20 dark:hover:text-red-400 ${
                theme === "vs-dark" ? "border-zinc-800 text-zinc-400" : "border-zinc-300 text-zinc-455"
              }`}
              title="Close Panel (Esc)"
              id="find-close-btn"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Replace Row */}
          <div className="flex flex-wrap items-center gap-3 bg-zinc-950/15 dark:bg-zinc-100/5 p-2 rounded-lg">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                <span className="font-mono text-zinc-450 font-bold">⇄</span>
              </div>
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleReplace();
                  }
                }}
                className={`flex-1 px-2.5 py-1 text-xs border rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-505 font-sans ${
                  theme === "vs-dark" ? "bg-zinc-950 border-zinc-850 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500" : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500"
                }`}
                id="replace-text-input"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleReplace}
                disabled={matches.length === 0}
                className="px-3 py-1 bg-indigo-650 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded text-[11px] font-bold transition-all cursor-pointer h-7 shadow-xs font-sans"
                title="Replace current highlighted match"
                id="replace-btn"
              >
                Replace
              </button>
              <button
                onClick={handleReplaceAll}
                disabled={matches.length === 0}
                className="px-3 py-1 bg-emerald-650 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded text-[11px] font-bold transition-all cursor-pointer h-7 shadow-xs font-sans"
                title="Replace all matches"
                id="replace-all-btn"
              >
                Replace All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor component container */}
      <div className="flex-1 min-h-0 relative">
        <MonacoEditor
          height="100%"
          language="markdown"
          theme={theme}
          options={{
            minimap: { enabled: false },
            wordWrap: "on",
            fontSize: 14,
            lineHeight: 22,
            padding: { top: 16, bottom: 16 },
            readOnly: readOnly,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            cursorBlinking: "smooth",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            cursorStyle: "line"
          }}
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  );
}
