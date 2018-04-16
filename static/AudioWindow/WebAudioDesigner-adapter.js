/**
 * Created by ky on 2017/04/15.
 */
const {ipcRenderer, remote} = require('electron');
const {BrowserWindow, dialog} = remote;
const fs = require('fs');
const url = require('url');

module.exports = function (audioGraph) {
  // let audioGraph;
  //
  // function audioGraph(graph) {
  //   audioGraph = graph;
  // }

  let isModified = false;

  function beModified(newValue) {
    if (!newValue) {
      graphObserver.disconnect();
      graphObserver.observe(audioGraph.base, observerConfig);
    }
    isModified = newValue;
    ipcRenderer.send('isModified', isModified);
    console.log('isModified=' + isModified);
  }

  function confirmDiscardChanges() {
    if (!isModified) return true;
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const options = {
      type: 'question',
      title: 'Confirm',
      buttons: ['Yes', 'No'],
      message: 'Are you sure you want to discard changes?'
    };
    let choice = dialog.showMessageBox(focusedWindow, options);
    return choice === 0;
  }

  let currentPath = '';

  function loadGraphData(path) {
    currentPath = path;
    fs.readFile(path, (error, contents) => {
      if (error !== null) {
        alert('error : ' + error);
        return;
      }
      let graphData = eval(contents.toString());
      audioGraph.Load(graphData);
      beModified(false);
    });
  }

  function loadGraphFromFile() {
    if (!confirmDiscardChanges()) return;
    const focusedWindow = BrowserWindow.getFocusedWindow();
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
      (path) => {
        if (path) {
          loadGraphData(path[0]);
        }
      });
  }

  function saveGraphData(path) {
    let graphDataString = audioGraph.GetJson().s;
    fs.writeFile(path, graphDataString, (error) => {
      if (error) {
        alert('error : ' + error);
        return;
      }
      currentPath = path;
      beModified(false);
    });
  }

  function saveGraphOnNewFile() {
    const focusedWindow = BrowserWindow.getFocusedWindow();
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
      function (path) {
        if (path) {
          saveGraphData(path);
        }
      }
    );
  }

  function saveGraphOnFile() {
    if (currentPath === '') {
      saveGraphOnNewFile();
      return;
    }
    saveGraphData(currentPath);
  }

  ipcRenderer.on('setParameter', function (event, paramID, value) {
    try {
      paramID = paramID.trim();
      let param = audioGraph.Find(paramID);
      if (param && param.constructor.name === 'ANode') {
        param = audioGraph.Find(paramID + '.val');
      }
      if (!param) {
        const parsedID = paramID.split('.');
        const node = audioGraph.Find(parsedID.slice(0, parsedID.length - 1).join('.'));
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

  ipcRenderer.on('audioSuspend', function (event) {
    audioSuspend();
  });

  ipcRenderer.on('audioResume', function (event) {
    audioResume();
  });

  ipcRenderer.on('playNode', function (event, nodeName) {
    const node = audioGraph.Find(nodeName);
    if (!node) {
      console.log(`no such node: ${nodeName}`);
      return;
    }
    playNode(node);
  });

  ipcRenderer.on('playAll', function (event) {
    playAll();
  });

  ipcRenderer.on('stopNode', function (event, nodeName) {
    const node = audioGraph.Find(nodeName);
    if (!node) {
      console.log(`no such node: ${nodeName}`);
      return;
    }
    stopNode(node);
  });

  ipcRenderer.on('stopAll', function (event) {
    stopAll();
  });

  ipcRenderer.on('newGraph', function (event) {
    if (!confirmDiscardChanges()) return;
    audioGraph.New();
    beModified(false);
  });

  ipcRenderer.on('loadGraphFromFile', (event) => {
    loadGraphFromFile();
  });

  ipcRenderer.on('loadGraphFromURL', (event) => {
    loadGraphFromURL();
  });

  ipcRenderer.on('saveGraph', function (event) {
    saveGraphOnFile();
  });

  ipcRenderer.on('saveGraphAs', function (event) {
    saveGraphOnNewFile();
  });

  // Observe Graph changes.
  const graphObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      console.log(mutation.type);
      beModified(true);
    });
  });
  // Observe adding/removing Node and Connect.
  const observerConfig = {attributes: false, childList: true, characterData: false, subtree: true};
  graphObserver.observe(audioGraph.base, observerConfig);


  function showPrompt(dialog, defaultResult) {
    return new Promise((resolve, reject) => {
      dialog.querySelector('#result').value = defaultResult;
      dialog.showModal();

      function onClose(event) {
        dialog.removeEventListener('close', onClose);
        if (dialog.returnValue === 'ok') {
          const resultValue = dialog.querySelector('#result').value;
          resolve(resultValue);
        } else {
          reject();
        }
      }

      dialog.addEventListener('close', onClose, {once: true});
    });
  }

  const renameDialog = document.querySelector('#rename-dialog');

  audioGraph.Rename = function (node) {
    const nodeTitleElem = node.child[0].elem.childNodes[0];
    showPrompt(renameDialog, nodeTitleElem.nodeValue)
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

  const urlDialog = document.querySelector('#url-dialog');

  function loadGraphFromURL() {
    if (!confirmDiscardChanges()) return;
    showPrompt(urlDialog).then((result) => {
      const graphDataString = url.parse(result, true).query.b;
      const graphDataJson = DecBase64(graphDataString, true);
      const graphData = eval(graphDataJson);
      audioGraph.Load(graphData);
      beModified(false);
    });
  }

  function audioResume() {
    if (audioGraph.play === true) return;
    const playBtn = document.getElementById('playbtn');
    audioGraph.play = true;
    audioctx.resume();
    playBtn.innerHTML = 'Stop';
  }

  function playNode(node) {
    audioResume();
    if (node.subtype === 'key') {
      node.io.inputs[0] = 1;
    } else if (node.play && !node.play.press) {
      node.play.Press(true);
    } else if (node.audio) {
      node.audio.play();
    }
    audioGraph.Reconnect(node);
  }

  function playAll() {
    audioGraph.child.forEach((node) => {
      playNode(node);
    });
  }

  function audioSuspend() {
    if (audioGraph.play === false) return;
    const playBtn = document.getElementById('playbtn');
    audioGraph.play = false;
    audioctx.suspend();
    playBtn.innerHTML = 'Start';
  }

  function stopNode(node) {
    if (node.subtype === 'key') {
      node.io.inputs[0] = 0;
    } else if (node.play && node.play.press) {
      node.play.Press(false);
    } else if (node.audio) {
      node.audio.pause();
      node.audio.currentTime = 0;
    }
  }

  function stopAll() {
    audioGraph.child.forEach((node) => {
      stopNode(node);
    });
  }
};
