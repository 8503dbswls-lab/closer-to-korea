제품 스니펫 경고 수정본

현재 배포된 세 상품 가이드와 JS, 생성 스크립트를 기준으로 수정했습니다.
확인되지 않은 가격/리뷰/평점을 추가하지 않고 설명 페이지에 맞게 WebPage 구조화 데이터를 사용합니다.
상품 가이드의 본문, 사진, 화면 구성은 보존됩니다.

적용 방법
1. ZIP을 풉니다.
2. 세 HTML 파일과 js, scripts 폴더를 GitHub 저장소 최상위에 복사하여 덮어씁니다.
3. GitHub Desktop 변경 목록에서 5개 코드 파일을 확인합니다.
4. Commit 후 Push origin을 누릅니다.
커밋 메시지: Use WebPage schema for editorial product guides

배포 후 왁뿌볼 URL을 Search Console 실제 URL 테스트로 다시 검사하세요.
제품 스니펫 항목이 사라지는 것이 이번 수정의 의도입니다. 제품 리치 결과를 획득하는 수정이 아닙니다.
이전 보고서의 경고는 구글 재수집 전까지 남을 수 있습니다.
일반 색인 등록과 검색 순위는 보장되지 않습니다.

수정 파일
product-egg-steamer.html
product-kimchi-cutter-container.html
product-grape-wakppubol.html
js/product.js
scripts/build-static-product-pages.mjs
