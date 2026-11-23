# 성과면담 노트

팀원 성과면담을 준비하고, 면담 중 답변을 카드 단위로 기록하고, 팀원별 Word 보고서로 내보내는 모바일 앱(PWA)입니다.

- 주소: https://woori-001.github.io/perf-review/
- 휴대폰에서 열고 **홈 화면에 추가**(아이폰 Safari) / **앱 설치**(안드로이드 Chrome)하면 앱처럼 씁니다.
- 로그인 없이 바로 열립니다 (소유자 요청).

## 데이터
- Supabase `woori-001's Project`
  - `public.perf_review_sheets` · 공통 준비(kind=common, 1인 1행) + 면담자별 기록(kind=member, data jsonb)
  - `public.perf_review_hist` · 수정/삭제 전 내용 자동 보관(10분 간격, 삭제 시 즉시) · 본인만 읽기
- RLS: 로그인 없이(anon) `user_id is null` 행만 조회·추가·수정·삭제. 주소와 공개 키를 아는 사람은 내용을 볼 수 있으니 민감한 내용은 주의.
  (로그인 사용자용 `user_id = auth.uid()` 정책도 남아 있어, 나중에 로그인 방식으로 되돌릴 수 있음)
- 이 앱은 다른 앱의 테이블을 읽거나 쓰지 않습니다.

## 파일
- `index.html`, `app.css`, `app.js` · 화면과 로직
- `sw.js`, `manifest.webmanifest`, `icons/` · 설치/오프라인
- `vendor/` · supabase-js 2.x, docx 8.5.0 (오프라인 동작을 위해 포함)
