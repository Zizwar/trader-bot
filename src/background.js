/* eslint-disable no-undef */
import {
  app,
  protocol,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
} from 'electron';
import path from 'path';
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib';
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer';
import { version, name, author } from '../package.json';
import initDb from './lib/initDb';

const isDevelopment = process.env.NODE_ENV !== 'production';
let tray = null;

// set app about
app.setAboutPanelOptions({
  applicationName: name,
  applicationVersion: version,
  version,
  copyright: 'Michael Fischer 2021',
  authors: [author],
});

// get the app root directory
const home = app.getPath('userData');

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } },
]);

async function createWindow(options, html) {
  // Create the browser window.
  const win = new BrowserWindow(options);

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(`${process.env.WEBPACK_DEV_SERVER_URL}${html}`);
    if (!process.env.IS_TEST) win.webContents.openDevTools();
  } else {
    createProtocol('app');
    // Load the index.html when not in development
    win.loadURL(`app://.${html}`);
  }

  win.on('minimize', (event) => {
    event.preventDefault();
    win.hide();
  });

  win.on('close', (event) => {
    // TODO: store quit state in variable
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
    }

    return false;
  });

  return win;
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    const ui = await createWindow({
      title: name,
      width: 800,
      height: 600,
      webPreferences: {
        // Use pluginOptions.nodeIntegration, leave this alone
        // eslint-disable-next-line max-len
        // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
        enableRemoteModule: true,
        webSecurity: false,
      },
    }, '/index.html');
    ui.maximize();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Configure',
        click: () => {
          ui.show();
        },
      },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    // create hiden window process
    const main = await createWindow({
      // show: false,
      title: 'hidden window',
      width: 800,
      height: 600,
      webPreferences: {
        // Use pluginOptions.nodeIntegration, leave this alone
        // eslint-disable-next-line max-len
        // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
        enableRemoteModule: true,
        webSecurity: false,
      },
    }, '/worker.html');
    main.maximize();
    // main.hide();

    // relay strategy event to main process
    ipcMain.on('strategy', (event, payload) => {
      main.webContents.send('strategy', payload);
    });

    // send login event to hidden window (data )
    ipcMain.on('login', (event, payload) => {
      main.webContents.send('login', payload);
    });
    // send log event to main window
    ipcMain.on('worker-log', (event, log) => {
      ui.webContents.send('worker-log', log);
    });

    // quit on exit signal
    ipcMain.on('quit', () => {
      app.quit();
    });
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString());
    }
  }

  // initialize local db's
  try {
    await initDb(home);
  } catch (e) {
    console.error(e.message);
  }

  tray = new Tray(path.resolve(__static, 'iconTemplate.png'));
  tray.setToolTip('Trader Bot');

  const ui = await createWindow({
    title: name,
    width: 800,
    height: 600,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // eslint-disable-next-line max-len
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      enableRemoteModule: true,
      webSecurity: false,
    },
  }, '/index.html');
  ui.maximize();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Configure',
      click: () => {
        ui.show();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // create hidden window for main applicaiton code
  const main = await createWindow({
    // show: false,
    title: 'hidden window',
    width: 800,
    height: 600,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // eslint-disable-next-line max-len
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      enableRemoteModule: true,
      webSecurity: false,
    },
  }, '/worker.html');
  main.maximize();
  // main.hide();

  // relay strategy event to main process
  ipcMain.on('strategy', (event, payload) => {
    main.webContents.send('strategy', payload);
  });

  // send login event to hidden window (data )
  ipcMain.on('login', (event, payload) => {
    main.webContents.send('login', payload);
  });
  // send log event to main window
  ipcMain.on('worker-log', (event, log) => {
    ui.webContents.send('worker-log', log);
  });

  // quit on exit signal
  ipcMain.on('quit', () => {
    app.quit();
  });
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit();
      }
    });
  } else {
    process.on('SIGTERM', () => {
      app.quit();
    });
  }
}
