const { ipcMain } = require('electron');
const { exec } = require('child_process');

// ─── System Controls (Volume, Brightness, Settings) ─────────────────────────

// Volume control via Windows Core Audio API (Base64-encoded PowerShell to avoid shell escaping)
// The C# COM boilerplate is shared via AUDIO_COM_TYPEDEF, only the action line differs per case.

const AUDIO_COM_TYPEDEF = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int f();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, System.Guid.Empty)); }
  }
  public static bool Mute {
    get { bool mute; Marshal.ThrowExceptionForHR(Vol().GetMute(out mute)); return mute; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, System.Guid.Empty)); }
  }
}
'@`;

ipcMain.handle('system-volume', async (event, { action, level }) => {
  return new Promise((resolve) => {
    let psAction = '';
    switch (action) {
      case 'set': {
        const vol = Math.max(0, Math.min(100, Number(level) || 0)) / 100;
        psAction = `[Audio]::Volume = ${vol}\nWrite-Output "Volume set to ${Math.round(vol * 100)}%"`;
        break;
      }
      case 'get':
        psAction = `Write-Output ([Math]::Round([Audio]::Volume * 100))`;
        break;
      case 'mute':
        psAction = `[Audio]::Mute = $true\nWrite-Output "Muted"`;
        break;
      case 'unmute':
        psAction = `[Audio]::Mute = $false\nWrite-Output "Unmuted"`;
        break;
      default:
        resolve({ success: false, error: `Unknown volume action: ${action}` });
        return;
    }
    const psScript = `${AUDIO_COM_TYPEDEF}\n${psAction}`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout: 15000 }, (error, stdout) => {
      resolve(error ? { success: false, error: error.message } : { success: true, result: stdout.trim() });
    });
  });
});

// Brightness control via WMI (laptops only)
ipcMain.handle('system-brightness', async (event, { action, level }) => {
  return new Promise((resolve) => {
    let psCommand = '';
    switch (action) {
      case 'set':
        const b = Math.max(0, Math.min(100, parseInt(level)));
        psCommand = `(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(0, ${b}); Write-Output "Brightness set to ${b}%"`;
        break;
      case 'get':
        psCommand = `(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness`;
        break;
      default:
        resolve({ success: false, error: `Unknown brightness action: ${action}` });
        return;
    }
    exec(`powershell -NoProfile -Command "${psCommand}"`, { timeout: 10000 }, (error, stdout) => {
      if (error && (error.message.includes('Not supported') || error.message.includes('WmiMonitorBrightness'))) {
        resolve({ success: false, error: 'Brightness control not available on this device (typically laptops only).' });
      } else {
        resolve(error ? { success: false, error: error.message } : { success: true, result: stdout.trim() });
      }
    });
  });
});

// Open Windows Settings pages
ipcMain.handle('open-settings', async (event, page) => {
  const settingsMap = {
    'home': 'ms-settings:', 'wifi': 'ms-settings:network-wifi', 'network': 'ms-settings:network-status',
    'bluetooth': 'ms-settings:bluetooth', 'display': 'ms-settings:display', 'sound': 'ms-settings:sound',
    'notifications': 'ms-settings:notifications', 'power': 'ms-settings:powersleep', 'battery': 'ms-settings:batterysaver',
    'storage': 'ms-settings:storagesense', 'personalization': 'ms-settings:personalization',
    'background': 'ms-settings:personalization-background', 'colors': 'ms-settings:personalization-colors',
    'lockscreen': 'ms-settings:lockscreen', 'themes': 'ms-settings:themes', 'apps': 'ms-settings:appsfeatures',
    'defaultapps': 'ms-settings:defaultapps', 'datetime': 'ms-settings:dateandtime', 'language': 'ms-settings:regionlanguage',
    'keyboard': 'ms-settings:keyboard', 'mouse': 'ms-settings:mousetouchpad', 'touchpad': 'ms-settings:devices-touchpad',
    'printers': 'ms-settings:printers', 'privacy': 'ms-settings:privacy', 'camera': 'ms-settings:privacy-webcam',
    'microphone': 'ms-settings:privacy-microphone', 'update': 'ms-settings:windowsupdate', 'about': 'ms-settings:about',
    'vpn': 'ms-settings:network-vpn', 'proxy': 'ms-settings:network-proxy', 'accounts': 'ms-settings:yourinfo',
    'signin': 'ms-settings:signinoptions', 'gaming': 'ms-settings:gaming-gamebar', 'accessibility': 'ms-settings:easeofaccess',
    'nightlight': 'ms-settings:nightlight',
  };
  const key = page.toLowerCase().trim().replace(/\s+/g, '');
  const uri = settingsMap[key] || `ms-settings:${key}`;
  return new Promise((resolve) => {
    exec(`start "" "${uri}"`, (error) => {
      resolve(error ? { success: false, error: error.message } : { success: true, message: `Opened ${page} settings.` });
    });
  });
});

// ─── Bluetooth & WiFi Control ───────────────────────────────────────────────

// Helper: Run complex PowerShell via Base64 encoding (avoids escaping nightmares)
function runPS(script, timeout = 15000) {
  return new Promise((resolve) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { timeout }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: (stderr || error.message).trim() });
      } else {
        resolve({ success: true, result: stdout.trim() });
      }
    });
  });
}

// Windows Radio API helper (for Bluetooth & WiFi on/off without admin)
const RADIO_HELPER = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
[Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime] | Out-Null
$radios = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
`;

// Bluetooth Control
ipcMain.handle('bluetooth-control', async (event, { action, deviceName }) => {
  switch (action) {
    case 'on':
      return runPS(`${RADIO_HELPER}
$bt = $radios | Where-Object { $_.Kind -eq 'Bluetooth' }
if ($bt) { Await ($bt.SetStateAsync([Windows.Devices.Radios.RadioState]::On)) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null; Write-Output 'Bluetooth turned on' }
else { Write-Output 'No Bluetooth radio found' }`);
    case 'off':
      return runPS(`${RADIO_HELPER}
$bt = $radios | Where-Object { $_.Kind -eq 'Bluetooth' }
if ($bt) { Await ($bt.SetStateAsync([Windows.Devices.Radios.RadioState]::Off)) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null; Write-Output 'Bluetooth turned off' }
else { Write-Output 'No Bluetooth radio found' }`);
    case 'status':
      return runPS(`${RADIO_HELPER}
$bt = $radios | Where-Object { $_.Kind -eq 'Bluetooth' }
if ($bt) { Write-Output "Bluetooth is $($bt.State)" } else { Write-Output 'No Bluetooth radio found' }`);
    case 'scan':
      return runPS(`Get-PnpDevice -Class Bluetooth -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -and $_.Class -eq 'Bluetooth' } | Select-Object FriendlyName, Status, InstanceId | ConvertTo-Json -Compress`, 20000);
    case 'connect':
      // Programmatic BT device connection is extremely device-specific on Windows.
      // The most reliable approach is to open Bluetooth settings for the user.
      exec(`start "" "ms-settings:bluetooth"`, () => {});
      return { success: true, message: `Opened Bluetooth settings. Please select "${deviceName || 'the device'}" to connect. Tell me once it's done.` };
    default:
      return { success: false, error: `Unknown bluetooth action: ${action}` };
  }
});

// WiFi Control
// NOTE: no `password` parameter. `netsh wlan connect` only works for profiles
// Windows has already saved (which store their own credentials). Joining a NEW
// network by password would require `netsh wlan add profile` with a generated
// XML profile — not supported here, so we don't pretend to accept one.
ipcMain.handle('wifi-control', async (event, { action, networkName }) => {
  switch (action) {
    case 'on':
      return runPS(`${RADIO_HELPER}
$wifi = $radios | Where-Object { $_.Kind -eq 'WiFi' }
if ($wifi) { Await ($wifi.SetStateAsync([Windows.Devices.Radios.RadioState]::On)) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null; Write-Output 'WiFi turned on' }
else { Write-Output 'No WiFi radio found' }`);
    case 'off':
      return runPS(`${RADIO_HELPER}
$wifi = $radios | Where-Object { $_.Kind -eq 'WiFi' }
if ($wifi) { Await ($wifi.SetStateAsync([Windows.Devices.Radios.RadioState]::Off)) ([Windows.Devices.Radios.RadioAccessStatus]) | Out-Null; Write-Output 'WiFi turned off' }
else { Write-Output 'No WiFi radio found' }`);
    case 'status':
      return runPS(`netsh interface show interface "Wi-Fi"`);
    case 'scan':
      return runPS(`$networks = netsh wlan show networks mode=bssid
$results = @()
$current = @{}
foreach ($line in $networks) {
  if ($line -match '^SSID \\d+ : (.+)') { if ($current.SSID) { $results += $current }; $current = @{ SSID = $Matches[1].Trim() } }
  elseif ($line -match 'Signal\\s+: (.+)') { $current.Signal = $Matches[1].Trim() }
  elseif ($line -match 'Authentication\\s+: (.+)') { $current.Auth = $Matches[1].Trim() }
}
if ($current.SSID) { $results += $current }
$results | ConvertTo-Json -Compress`, 15000);
    case 'connect':
      if (!networkName) return { success: false, error: 'Network name is required.' };
      return runPS(`netsh wlan connect name="${networkName}"
if ($LASTEXITCODE -eq 0) { Write-Output "Connected to ${networkName}" }
else { Write-Output "Could not connect to ${networkName}. Make sure the network profile exists." }`);
    case 'disconnect':
      return runPS(`netsh wlan disconnect; Write-Output "WiFi disconnected"`);
    case 'saved':
      return runPS(`(netsh wlan show profiles) -match 'All User Profile' | ForEach-Object { ($_ -split ':',2)[1].Trim() }`);
    default:
      return { success: false, error: `Unknown wifi action: ${action}` };
  }
});


