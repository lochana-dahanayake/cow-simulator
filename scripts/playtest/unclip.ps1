Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Cur2 {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool ClipCursor(IntPtr r);
  [DllImport("user32.dll")] public static extern bool GetClipCursor(out RECT r);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
}
'@
$b = New-Object Cur2+RECT; [void][Cur2]::GetClipCursor([ref]$b)
$w = [Cur2]::GetSystemMetrics(78); $h = [Cur2]::GetSystemMetrics(79)
if (($b.R - $b.L) -lt $w -or ($b.B - $b.T) -lt $h) { [void][Cur2]::ClipCursor([IntPtr]::Zero); "CURSOR WAS CLIPPED ($($b.L),$($b.T)-$($b.R),$($b.B)) -> released" } else { "cursor free" }
