Closer to Korea — Section Structure v1 + Automation v24

확정 구조
1. 모든 글은 Editorial Section 하나에만 속합니다.
   - everyday-korea
   - korean-kitchen
   - k-beauty
   - trends-finds
   - seen-online

2. Content Type은 별도 축입니다.
   - korea-discovery
   - culture-everyday
   - product-guide
   - mixed

3. Product Guides는 독립 Section이 아니라 교차 목록입니다.
   예: Korean Kitchen + product-guide
   → Korean Kitchen에도 보이고 Product Guides에도 보입니다.
   → URL/글은 하나뿐입니다.

4. Section 정렬
   - 1~3개 글: Featured 없음, 전부 All stories에 최신순
   - 4개 이상: Featured 1개 + 나머지 All stories 최신순
   - featured=true가 있으면 그 글 우선
   - 없으면 최신 글을 Featured

앞으로의 발행
Final Human Review
→ 발행 분류 설정 (Section 1개 + Content Type 1개)
→ A little Korean 사람 승인
→ 발행 JSON
→ S3B
→ 사이트가 자동 정렬

적용 A — GitHub 저장소
ZIP 전체를 저장소 최상위에 풀고:
APPLY_SECTION_STRUCTURE_V1.bat 실행

Commit 대상:
- js/main.js
- data/categories.json

적용 B — Apps Script
현재 Content Workspace UI 코드를
Closer_to_Korea_v25_INFO_CONTENT_WORKSPACE_UI_v24_AUTO_SECTION_SORTING.txt
전체 내용으로 교체

적용 C — S3B
scripts/s3b-import-publish.mjs
를 ZIP의 새 파일로 교체 후 Commit/Push

중요:
새 글은 발행 분류가 없으면 S3A/S3B가 발행을 막습니다.
따라서 잘못된 Section 기본값으로 조용히 들어가는 문제가 재발하지 않습니다.
