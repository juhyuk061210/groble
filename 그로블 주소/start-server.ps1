$ErrorActionPreference = "Stop"

$BundledNode = "C:\Users\Juhyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$Node = Get-Command node -ErrorAction SilentlyContinue

if ($Node) {
  & $Node.Source src/server.js
} elseif (Test-Path $BundledNode) {
  & $BundledNode src/server.js
} else {
  throw "Node.js를 찾을 수 없습니다. Node.js를 설치하거나 Codex 번들 런타임 경로를 확인해 주세요."
}
