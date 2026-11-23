# 성과면담 노트

팀원 성과면담을 준비하고, 면담 중 답변을 카드 단위로 기록하고, 팀원별 Word 보고서로 내보내는 모바일 앱(PWA)입니다.

- 주소: https://woori-001.github.io/perf-review/
- 휴대폰에서 열고 **홈 화면에 추가**(아이폰 Safari) / **앱 설치**(안드로이드 Chrome)하면 앱처럼 씁니다.
- 로그인: 다른 사내 앱과 같은 Supabase 계정(이메일·비밀번호)

## 데이터
- Supabase `woori-001's Project`
  - `public.perf_review_sheets` · 공통 준비(kind=common, 1인 1행) + 면담자별 기록(kind=member, data jsonb)
  - `public.perf_review_hist` · 수정/삭제 전 내용 자동 보관(10분 간격, 삭제 시 즉시) · 본인만 읽기
- RLS: 로그인한 본인 행(`user_id = auth.uid()`)만 조회·추가·수정·삭제. anon 접근 없음.
- 이 앱은 다른 앱의 테이블을 읽거나 쓰지 않습니다.

## 파일
- `index.html`, `app.css`, `app.js` · 화면과 로직
- `sw.js`, `manifest.webmanifest`, `icons/` · 설치/오프라인
- `vendor/` · supabase-js 2.x, docx 8.5.0 (오프라인 동작을 위해 포함)
