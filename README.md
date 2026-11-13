# StrictPass — Password Generator

Chrome Extension (Manifest V3) phong cách **Apple & 1Password Modern**, giải quyết triệt để lỗi **các setting đã chọn lúc được phản ánh lúc không**.

## Điểm nổi bật

1. **Thương hiệu & Logo StrictPass đồng bộ**:
   - Logo **Shield Check** phong cách Apple Squircle (Gradient Cobalt → Emerald) sắc nét trên cả thanh công cụ Chrome (`16px`–`128px`) và bên trong tab **About**.
2. **Giao diện Apple Modern rộng rãi (420px) với 3 Tab Segmented Control**:
   - Thanh trượt 3 tab: **Generator** | **History** (kèm badge đếm số mật khẩu đã copy) | **About** (giới thiệu tính năng & tính riêng tư 100% client-side).
   - Nút đổi nhanh **Dark / Light mode** ở góc phải.
3. **Cụm Hero Password Box tối giản**:
   - Nút **Copy** dạng icon-only gọn gàng (32×32px) với hiệu ứng chuyển sang dấu tích xanh `✓` khi copy thành công.
   - Nút **Regenerate** hiệu ứng xoay 360°.
   - Biểu tượng Khiên SVG đổi màu theo trạng thái (`Strong` / `Medium` / `Weak`) và thanh độ mạnh 4 viên nang kèm Entropy bits.
4. **Bộ điều khiển Length với nút Stepper `−` và `+` lớn, dễ bấm**:
   - Cụm `[ − ] [ 16 ] [ + ]` kết hợp thanh trượt kéo nhanh từ 1 đến 99.
5. **4 Nút Pill chọn nhanh nhóm ký tự (`A–Z`, `a–z`, `0–9`, `!@#`)**:
   - Khi chọn, hiển thị **huy hiệu dấu tích xanh `✓`** ở góc trên phải cùng viền/nền tương phản rõ nét.
   - Ô nhập ký tự `Special` tự động gập gọn khi tắt nút `!@# Special`.
6. **Thuật toán CSPRNG + Strict Inclusion 100%**:
   - Luôn đảm bảo xuất hiện ít nhất 1 ký tự từ mỗi nhóm đã bật, xáo trộn bằng Fisher-Yates CSPRNG (`crypto.getRandomValues`).

## Cài đặt / Cập nhật trên Google Chrome

1. Mở Chrome và vào `chrome://extensions/`
2. Bật **Developer mode** ở góc phải.
3. Nhấn nút **Reload ↻** trên card của extension (hoặc nhấn **Load unpacked** và chọn thư mục `/Users/tuyennq1001/htdocs/projects/prj-random-password`).

## Chạy kiểm thử tự động (Unit Tests)

```bash
npm test
```
