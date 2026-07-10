# ⛳ 오장 내기 정산 계산기

골프 라운드 중 폰으로 쓰는 오장(타당 정산) 내기 자동 정산 웹앱. 요구사항과 룰 명세는 [PRD.md](./PRD.md) 참고.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm test           # 정산 엔진 단위 테스트 + 통합 테스트
npm run build      # 프로덕션 빌드 (dist/) — PWA 포함
npm run preview    # 빌드 결과 로컬 확인
```

같은 와이파이의 폰에서 열려면 `npx vite --host` 후 안내되는 Network 주소로 접속.

## 구조

- `src/engine/` — 정산 엔진 (UI와 분리된 순수 함수 + vitest 테스트). 룰 로직은 전부 여기에.
- `src/components/` — 설정 / 홀 입력 / 정산표 3개 화면
- `src/store.ts` — useReducer 상태 + localStorage 자동 저장(앱 꺼져도 라운드 복구)

## 배포 (추후)

정적 호스팅(GitHub Pages / Vercel 등)에 `dist/`를 올리면 끝. `base: './'`라 서브경로에서도 동작.
PWA 설정이 되어 있어 배포 후 아이폰 사파리에서 "홈 화면에 추가"하면 앱처럼 설치되고 오프라인에서도 동작한다.
