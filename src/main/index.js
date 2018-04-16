'use strict'

import { app, BrowserWindow, Menu, MenuItem, dialog, ipcMain, shell } from 'electron'
import * as path from 'path'
import { format as formatUrl } from 'url'

const isDevelopment = process.env.NODE_ENV !== 'production'

const WAD4SServer = require('./WAD4SServer');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let scratchServer;
let isModified = false;

const shouldQuit = app.makeSingleInstance(() => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

if (shouldQuit) {
    app.quit();
}

// function createMainWindow() {
//     const ScratchRSP = require('scratch-rsp');
//
//   const window = new BrowserWindow()
//
//   if (isDevelopment) {
//     window.webContents.openDevTools()
//   }
//
//   if (isDevelopment) {
//     window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
//   }
//   else {
//     window.loadURL(formatUrl({
//       pathname: path.join(__dirname, 'index.html'),
//       protocol: 'file',
//       slashes: true
//     }))
//   }
//
//   window.on('closed', () => {
//     mainWindow = null
//   })
//
//   window.webContents.on('devtools-opened', () => {
//     window.focus()
//     setImmediate(() => {
//       window.focus()
//     })
//   })
//
//   return window
// }


const createMainWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768
    });

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__static}/AudioWindow/index.html`);

    // Emitted when the window to close.
    mainWindow.on('close', (event) => {
        if (isModified) {
            const options = {
                type: 'question',
                title: 'Confirm',
                buttons: ['Yes', 'No'],
                message: 'Are you sure you want to quit?'
            };
            const choice = dialog.showMessageBox(mainWindow, options);
            if (choice === 0) {
                // 'Yes'
                if (mainWindow.scratchSocket) {
                    mainWindow.scratchSocket.destroy();
                }
                // Do not prevent the process.
            } else {
                // 'No'
                event.preventDefault();
            }
        }
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });

    if (scratchServer) {
        scratchServer.audioWindow = mainWindow;
    } else {
        scratchServer = new WAD4SServer(mainWindow).createServer();
        scratchServer.start();
    }
};

let template = [{
    label: 'File',
    submenu: [
        {
            label: 'New',
            accelerator: 'CmdOrCtrl+n',
            click: function (item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.webContents.send('newGraph');
                }
            }
        }, {
            label: 'Open',
            accelerator: 'CmdOrCtrl+o',
            click: (item, focusedWindow) => {
                if (focusedWindow) {
                    focusedWindow.webContents.send('loadGraphFromFile');
                }
            }
        }, {
            label: 'Open Link',
            accelerator: 'CmdOrCtrl+l',
            click: (item, focusedWindow) => {
                if (focusedWindow) {
                    focusedWindow.webContents.send('loadGraphFromURL');
                }
            }
        }, {
            label: 'Save',
            accelerator: 'CmdOrCtrl+s',
            click: function (item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.webContents.send('saveGraph');
                }
            }
        }, {
            label: 'Save as...',
            accelerator: 'Shift+CmdOrCtrl+s',
            click: function (item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.webContents.send('saveGraphAs');
                }
            }
        }
    ]
},
    {
        label: 'Edit',
        submenu: [
            {
                label: 'Undo',
                accelerator: 'CmdOrCtrl+Z',
                role: 'undo'
            }, {
                label: 'Redo',
                accelerator: 'Shift+CmdOrCtrl+Z',
                role: 'redo'
            }, {
                type: 'separator'
            }, {
                label: 'Cut',
                accelerator: 'CmdOrCtrl+X',
                role: 'cut'
            }, {
                label: 'Copy',
                accelerator: 'CmdOrCtrl+C',
                role: 'copy'
            }, {
                label: 'Paste',
                accelerator: 'CmdOrCtrl+V',
                role: 'paste'
            }, {
                label: 'Select All',
                accelerator: 'CmdOrCtrl+A',
                role: 'selectall'
            }]
    }, {
        label: 'Scratch',
        submenu: [{
            label: 'Remote Sensor Connect',
            type: 'checkbox',
            checked: false,
            click: function (item, focusedWindow) {
                if (!mainWindow) {
                    item.checked = false;
                    return;
                }
                if (mainWindow.scratchSocket) {
                    mainWindow.scratchSocket.destroy();
                    mainWindow.scratchSocket = null;
                    item.checked = false;
                } else {
                    connectScratchRSP(mainWindow, () => {
                        item.checked = true;
                    });
                }
            }
        }]
    }, {
        label: 'View',
        submenu: [{
            label: 'Toggle Full Screen',
            accelerator: (() => {
                if (process.platform === 'darwin') {
                    return 'Ctrl+Command+F';
                }
                return 'F11';
            })(),
            click: function (item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
                }
            }
        }
        ]
    }, {
        label: 'Window',
        role: 'window',
        submenu: [
            {
                label: 'Minimize',
                accelerator: 'CmdOrCtrl+M',
                role: 'minimize'
            }
        ]
    }, {
        label: 'Help',
        role: 'help',
        submenu: [{
            label: 'Learn More',
            click: function () {
                shell.openExternal('http://electron.atom.io')
            }
        }
        ]
    }];


function addUpdateMenuItems(items, position) {
    // if (process.mas) {
    //   // Mac App Store build
    //   return;
    // }
    //
    // const version = electron.app.getVersion();
    // let updateItems = [{
    //   label: `Version ${version}`,
    //   enabled: false
    // }, {
    //   label: 'Checking for Update',
    //   enabled: false,
    //   key: 'checkingForUpdate'
    // }, {
    //   label: 'Check for Update',
    //   visible: false,
    //   key: 'checkForUpdate',
    //   click: function () {
    //     require('electron').autoUpdater.checkForUpdates()
    //   }
    // }, {
    //   label: 'Restart and Install Update',
    //   enabled: true,
    //   visible: false,
    //   key: 'restartToUpdate',
    //   click: function () {
    //     require('electron').autoUpdater.quitAndInstall()
    //   }
    // }];
    //
    // items.splice.apply(items, [position, 0].concat(updateItems))
}

function findReopenMenuItem() {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;

    let reopenMenuItem;
    menu.items.forEach(function (item) {
        if (item.submenu) {
            item.submenu.items.forEach(function (item) {
                if (item.key === 'reopenMenuItem') {
                    reopenMenuItem = item
                }
            })
        }
    });
    return reopenMenuItem
}

if (process.platform === 'darwin') {
    const name = app.getName();
    template.unshift({
        label: name,
        submenu: [{
            label: `About ${name}`,
            role: 'about'
        }, {
            type: 'separator'
        }, {
            label: 'Services',
            role: 'services',
            submenu: []
        }, {
            type: 'separator'
        }, {
            label: `Hide ${name}`,
            accelerator: 'Command+H',
            role: 'hide'
        }, {
            label: 'Hide Others',
            accelerator: 'Command+Alt+H',
            role: 'hideothers'
        }, {
            label: 'Show All',
            role: 'unhide'
        }, {
            type: 'separator'
        }, {
            label: 'Quit',
            accelerator: 'Command+Q',
            click: function () {
                app.quit();
            }
        }]
    });

    // Window menu.
    template[4].submenu.push({
        type: 'separator'
    }, {
        label: 'Bring All to Front',
        role: 'front'
    });

    addUpdateMenuItems(template[0].submenu, 1)
}

if (process.platform === 'win32') {
    const helpMenu = template[template.length - 1].submenu;
    addUpdateMenuItems(helpMenu, 0)
}


app.on('ready', function () {
    const menu = Menu.buildFromTemplate(template);
    app.scratchRSCMenu = menu.items[3].submenu.items[0];
    Menu.setApplicationMenu(menu);
    createMainWindow();

    // Development settings
    if (process.env.NODE_ENV === 'development') {
        mainWindow.openDevTools();
        mainWindow.webContents.on('context-menu', (e, props) => {
            const {x, y} = props;
            Menu.buildFromTemplate([{
                label: 'Inspect element',
                click() {
                    mainWindow.inspectElement(x, y);
                }
            }]).popup(mainWindow);
        });
    }
});


// app.on('browser-window-created', function () {
//   let reopenMenuItem = findReopenMenuItem();
//   if (reopenMenuItem) reopenMenuItem.enabled = false
// });

// app.on('window-all-closed', function () {
//   let reopenMenuItem = findReopenMenuItem();
//   if (reopenMenuItem) reopenMenuItem.enabled = true
// });

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    app.quit();
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createMainWindow();
    }
});

app.on('before-quit', (event) => {
});

app.on('will-quit', function (event) {
    // to prevent remain icon in dock on MacOS
    app.dock.hide();
});

ipcMain.on('isModified', (event, boolean) => {
    isModified = boolean;
});


// Scratch Remote Sensor Connection

const ScratchRSP = require('scratch-rsp');

function connectScratchRSP(audioWindow, success) {
    if (!audioWindow) return;
    const newSocket = ScratchRSP.createConnection('localhost', () => {
        console.log('ScratchRSP connected.');
        newSocket.on('sensor-update', function (sensorsMap) {
            for (let key of sensorsMap.keys()) {
                if (key === 'playNode') {
                    audioWindow.webContents.send('playNode', sensorsMap.get(key));
                } else if (key === 'stopNode') {
                    audioWindow.webContents.send('stopNode', sensorsMap.get(key));
                } else {
                    audioWindow.webContents.send('setParameter', key, sensorsMap.get(key));
                }
                console.info(key + " = " + sensorsMap.get(key));
            }
        });
        newSocket.on('broadcast', (event) => {
            event = event.toLowerCase();
            if (event === 'playall') {
                audioWindow.webContents.send('playAll');
            } else if (event === 'stopall') {
                audioWindow.webContents.send('stopAll');
            }
            console.info(event);
        });
        newSocket.on('close', () => {
            audioWindow.scratchSocket = null;
            if (app.scratchRSCMenu) {
                app.scratchRSCMenu.checked = false;
            }
            console.log('ScratchRSP closed.');
        });
        audioWindow.scratchSocket = newSocket;
        if (success) {
            success(newSocket);
        }
    });
    newSocket.on('error', () => {
        dialog.showErrorBox('Connection Error', 'Could not connect via Scratch Remote Sensor Protocol.\nShould be enabled "Remote Sensor Connections" in the local Scratch.');
        if (app.scratchRSCMenu) {
            app.scratchRSCMenu.checked = false;
        }
        console.log('Could not connect ScratchRSP.');
    });
}

