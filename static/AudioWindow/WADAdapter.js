/**
 * WADAdapter.js
 *
 * Created by ky on 2018/04/19.
 */

const {ipcRenderer, remote} = require('electron');
const {BrowserWindow, dialog} = remote;
const fs = require('fs');
const url = require('url');

const graphObserverConfig = {attributes: true, childList: true, characterData: true, subtree: true};

module.exports = class WADAdapter {
    constructor(audioGraph, designerDom) {
        this.graph = audioGraph;
        this.dom = designerDom;
        this.isModified = false;
        this.currentPath = null;
        this.defaultPatch = null;
        this.modAudioGraph();
        this.registerIPC();
        this.setupDOM();
    }

    modAudioGraph() {
        this.graph.Rename = (node) => {
            let nodeTitleElem = node.child[0].elem.childNodes[0];
            showPrompt(this.dom.querySelector('#rename-dialog'), nodeTitleElem.nodeValue)
                .then((newName) => {
                    if (!newName || newName === '') return;
                    if (newName === nodeTitleElem.nodeValue) return;
                    node.name = newName;
                    nodeTitleElem.nodeValue = newName;
                })
                .catch((error) => {
                    // do nothing
                });
        };
    }

    beModified(newValue) {
        if (!newValue) {
            if (this.graphObserver) {
                this.graphObserver.disconnect();
                this.graphObserver.observe(this.graph.base, graphObserverConfig);
            }
        }
        this.isModified = newValue;
        ipcRenderer.send('isModified', newValue);
    }

    confirmDiscardChanges() {
        if (!this.isModified) return true;
        let focusedWindow = BrowserWindow.getFocusedWindow();
        let options = {
            type: 'question',
            title: 'Confirm',
            buttons: ['Yes', 'No'],
            message: 'Are you sure you want to discard changes?'
        };
        let choice = dialog.showMessageBox(focusedWindow, options);
        return choice === 0;
    }

    loadPatchFromFile(path, confirm) {
        if (confirm) {
            if (!this.confirmDiscardChanges()) return;
        }
        fs.readFile(path, (error, contents) => {
            if (error !== null) {
                alert('error : ' + error);
                return;
            }
            this.currentPath = path;
            let patch = eval(contents.toString());
            this.loadPatch(patch);
        });
    }

    loadPatch(patch) {
        this.graph.Load(patch);
        this.beModified(false);
    }

    loadDefaultPatch() {
        if (!this.currentPath) {
            // Default patch
            this.loadPatch([{n: "destination", x: 365, y: 63, mode: 0, ver: 1, W: 800, H: 600}, {
                n: "gai1",
                x: 195,
                y: 58,
                c: ["destination"]
            }, {n: "osc1", x: 14, y: 58, c: ["gai1"]}])
        }
        this.graphObserver = new MutationObserver((ignore) => {
            this.beModified(true);
        });
        this.graphObserver.observe(this.graph.base, graphObserverConfig);
    }

    openPatchFromFile() {
        if (!this.confirmDiscardChanges()) return;
        let focusedWindow = BrowserWindow.getFocusedWindow();
        dialog.showOpenDialog(
            focusedWindow,
            {
                properties: ['openFile'],
                filters: [
                    {
                        name: 'Graph',
                        extensions: ['wad']
                    }
                ]
            },
            (filePaths) => {
                if (filePaths) {
                    this.loadPatchFromFile(filePaths[0], false);
                }
            });
    }

    saveGraphData(path) {
        let graphDataString = this.graph.GetJson().s;
        fs.writeFile(path, graphDataString, (error) => {
            if (error) {
                dialog.showErrorBox('Save Error', 'Error: ' + error);
                return;
            }
            this.currentPath = path;
            this.beModified(false);
        });
    }

    saveGraphOnNewFile() {
        let focusedWindow = BrowserWindow.getFocusedWindow();
        dialog.showSaveDialog(
            focusedWindow,
            {
                properties: ['openFile'],
                filters: [
                    {
                        name: 'Graph',
                        extensions: ['wad']
                    }
                ]
            },
            (path) => {
                if (path) {
                    this.saveGraphData(path);
                }
            }
        );
    }

    saveGraphOnFile() {
        if (this.currentPath) {
            this.saveGraphOnNewFile();
            return;
        }
        this.saveGraphData(this.currentPath);
    }

    loadGraphFromURL() {
        if (!this.confirmDiscardChanges()) return;
        showPrompt(this.dom.querySelector('#url-dialog')).then((result) => {
            let graphDataString = url.parse(result, true).query['b'];
            let graphDataJson = DecBase64(graphDataString, true);
            let graphData = eval(graphDataJson);
            this.graph.Load(graphData);
            this.beModified(false);
        });
    }

    audioResume() {
        if (this.graph.play === true) return;
        this.graph.play = true;
        audioctx.resume();
        this.dom.getElementById('playbtn').innerHTML = 'Stop';
    }

    playNode(node) {
        this.audioResume();
        if (node.subtype === 'key') {
            node.io.inputs[0] = 1;
        } else if (node.play && !node.play.press) {
            node.play.Press(true);
        } else if (node.audio) {
            node.audio.play();
        }
        this.graph.Reconnect(node);
    }

    playAll() {
        this.graph.child.forEach((node) => {
            this.playNode(node);
        });
    }

    audioSuspend() {
        if (this.graph.play === false) return;
        this.graph.play = false;
        audioctx.suspend().then(() => {
            this.dom.getElementById('playbtn').innerHTML = 'Start';
        });
    }

    stopNode(node) {
        if (node.subtype === 'key') {
            node.io.inputs[0] = 0;
        } else if (node.play && node.play.press) {
            node.play.Press(false);
        } else if (node.audio) {
            node.audio.pause();
            node.audio.currentTime = 0;
        }
    }

    stopAll() {
        this.graph.child.forEach((node) => {
            this.stopNode(node);
        });
    }

    registerIPC() {
        let adapter = this;
        ipcRenderer.on('setParameter', function (event, paramID, value) {
            try {
                paramID = paramID.trim();
                let param = adapter.graph.Find(paramID);
                if (param && param.constructor.name === 'ANode') {
                    param = adapter.graph.Find(paramID + '.val');
                }
                if (!param) {
                    const parsedID = paramID.split('.');
                    const node = adapter.graph.Find(parsedID.slice(0, parsedID.length - 1).join('.'));
                    if (node && (node.subtype === 'key')) {
                        const keyboardParam = parsedID[parsedID.length - 1];
                        if (keyboardParam === 'note') {
                            const noteValue = parseInt(value);
                            if (Number.isNaN(noteValue)) {
                                console.info(`not valid for key note: ${paramID} = ${value}`);
                            } else {
                                node.io.inputs[1] = noteValue;
                            }
                            return;
                        } else if (keyboardParam === 'gate') {
                            node.io.inputs[2] = (value === '0') ? 0 : 1;
                            return;
                        }
                    }
                    console.info(`no such parameter: ${paramID}`);
                    return;
                }
                param.SetEdit(value);
            } catch (error) {
                console.info(`error on setParameter: ${error}`);
            }
        });

        ipcRenderer.on('audioSuspend', function (ignore) {
            adapter.audioSuspend();
        });

        ipcRenderer.on('audioResume', function (ignore) {
            adapter.audioResume();
        });

        ipcRenderer.on('playNode', function (event, nodeName) {
            const node = adapter.graph.Find(nodeName);
            if (!node) {
                console.log(`no such node: ${nodeName}`);
                return;
            }
            adapter.playNode(node);
        });

        ipcRenderer.on('playAll', function (ignore) {
            adapter.playAll();
        });

        ipcRenderer.on('stopNode', function (event, nodeName) {
            const node = adapter.graph.Find(nodeName);
            if (!node) {
                console.log(`no such node: ${nodeName}`);
                return;
            }
            adapter.stopNode(node);
        });

        ipcRenderer.on('stopAll', function (ignore) {
            adapter.stopAll();
        });

        ipcRenderer.on('newGraph', function (ignore) {
            if (!adapter.confirmDiscardChanges()) return;
            adapter.graph.New();
            adapter.beModified(false);
        });

        ipcRenderer.on('loadPatchFromFile', function (event, path) {
            adapter.loadPatchFromFile(path, true);
        });

        ipcRenderer.on('openPatchFromFile', (ignore) => {
            adapter.openPatchFromFile();
        });

        ipcRenderer.on('loadGraphFromURL', (ignore) => {
            adapter.loadGraphFromURL();
        });

        ipcRenderer.on('saveGraph', function (ignore) {
            adapter.saveGraphOnFile();
        });

        ipcRenderer.on('saveGraphAs', function (ignore) {
            adapter.saveGraphOnNewFile();
        });
    }

    setupDOM() {
        this.dom.body.ondragover = () => {
            return false;
        };
        this.dom.body.ondragleave = this.dom.body.ondragend = () => {
            return false;
        };
        this.dom.body.ondrop = (e) => {
            e.preventDefault();
            let file = e.dataTransfer.files[0];
            if (file.name.split('.').pop() === 'wad') {
                this.loadPatchFromFile(file.path, true);
            }
            return false;
        };
    }
};

function showPrompt(dialog, defaultResult) {
    return new Promise((resolve, reject) => {
        dialog.querySelector("input[name='result']").value = defaultResult;
        dialog.showModal();

        function onClose(ignore) {
            dialog.removeEventListener('close', onClose);
            if (dialog.returnValue === 'ok') {
                const resultValue = dialog.querySelector("input[name='result']").value;
                resolve(resultValue);
            } else {
                reject();
            }
        }

        dialog.addEventListener('close', onClose, {once: true});
    });
}
