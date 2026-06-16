# Groble to Leadgen Webhook

그로블 결제 완료 웹훅을 받아서, 결제자 이름/전화번호를 리드젠 특정 그룹으로 보내는 서버입니다.

24시간 서버로 올리는 방법은 [DEPLOY.md](DEPLOY.md)를 보면 됩니다.

## 실행

```powershell
copy .env.example .env
node src/server.js
```

PowerShell에서 `node`가 없다고 나오면 Codex 번들 Node로 실행할 수 있습니다.

```powershell
& "C:\Users\Juhyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" src/server.js
```

또는 이 파일을 실행해도 됩니다.

```powershell
.\start-server.ps1
```

만약 스크립트 실행이 막히면:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
```

상태 확인:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

## 그로블에 등록할 웹훅 주소

로컬 테스트에서는 외부에서 `localhost`에 접근할 수 없으므로 ngrok 같은 터널 주소가 필요합니다.

```text
https://발급받은-ngrok주소/webhook/groble
```

실서버에 올리면 아래처럼 실제 도메인을 사용합니다.

```text
https://내도메인.com/webhook/groble
```

## 먼저 테스트하는 방법

서버 실행 후 PowerShell에서:

```powershell
.\test-webhook.ps1
```

스크립트 실행이 막히면:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-webhook.ps1
```

리드젠 API 정보가 아직 없으면 정상적으로 수신 후 `leadgen_not_configured`로 기록됩니다.
`DRY_RUN=true` 상태에서는 실제 리드젠으로 보내지 않고, 어떤 값을 보낼지만 보여줍니다.

## 저장되는 파일

- `data/webhook-events.jsonl`: 들어온 모든 웹훅
- `data/unmatched-payments.jsonl`: 리드젠과 아직 매칭되지 않은 결제
- `data/processed-orders.jsonl`: 처리 완료한 주문

## 리드젠 연결에 필요한 값

붙여주신 코드에서 이 부분이 리드젠 그룹 주소입니다.

```js
var LEADGEN_SEQ = '4e7a457a4d7a553d';
```

그래서 `.env`에는 아래처럼 넣으면 됩니다.

```env
LEADGEN_SEQ=4e7a457a4d7a553d
LEADGEN_RESULT_URL=https://imaginative-rugelach-adae87.netlify.app/
DRY_RUN=false
```

`DRY_RUN=false`로 바꾸면 실제로 `https://leadgeny.kr/check/`에 결제자 정보가 전송됩니다.
