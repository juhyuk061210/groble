# 24시간 서버로 올리는 방법

제일 쉬운 방법은 Render에 올리는 것입니다.

## 1. GitHub에 이 폴더 올리기

이 폴더를 GitHub 저장소로 올립니다.

## 2. Render에서 새 서버 만들기

Render에서:

```text
New
→ Web Service
→ GitHub 저장소 선택
```

설정은 이렇게 넣습니다.

```text
Build Command: npm install
Start Command: npm start
```

24시간 계속 켜두려면 무료가 아니라 유료 인스턴스를 선택해야 합니다.

## 3. 환경값 넣기

Render의 Environment에 아래 값을 넣습니다.

```text
DRY_RUN=false
LEADGEN_SEQ=4e7a457a4d7a553d
LEADGEN_RESULT_URL=https://imaginative-rugelach-adae87.netlify.app/
```

## 4. 그로블에 넣을 주소

Render가 서버를 만들면 이런 주소가 나옵니다.

```text
https://내서버이름.onrender.com
```

그로블 웹훅에는 뒤에 `/webhook/groble`을 붙여서 넣으면 됩니다.

```text
https://내서버이름.onrender.com/webhook/groble
```

## 5. 작동 확인

아래 주소가 열리면 서버가 켜진 것입니다.

```text
https://내서버이름.onrender.com/health
```
