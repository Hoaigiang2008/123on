const express = require('express');
const app = express();
const path = require('path');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CƠ SỞ DỮ LIỆU ĐƯỢC LƯU TRỮ TẠM THỜI (TRÊN RAM SERVER)
let users = [
    { email: "admin@gmail.com", password: "123", phone: "0000000000", role: "admin", balance: 0, refBalance: 0, completedLinks: 0, bankInfo: "ADMIN BANK", refBy: null }
];
let links = [
    { id: "1", title: "Tài liệu ôn thi THPT Quốc Gia môn Văn Khối C", url: "https://shorten-link.com/example1", code: "LED9921", price: 3000 },
    { id: "2", title: "Bản Hack Mod Đồ Họa Siêu Mượt GTA V VN", url: "https://shorten-link.com/example2", code: "GTA8831", price: 4000 }
];
let withdrawals = [];
let chats = [];
let adminNotice = "Chào mừng bạn đến với hệ thống LEDLINK, chăm chỉ vượt link nhận quà khủng!";

// BỘ LỌC TỪ NGỮ BẬY BẠ
const CENSOR_WORDS = ["dm", "vcl", "clm", "đm", "cac", "lon", "buoi"];

// 1. ĐĂNG KÝ (KIỂM TRA DUY NHẤT SĐT VÀ EMAIL)
app.post('/api/register', (req, res) => {
    const { email, password, phone, refBy } = req.body;
    if (!email || !password || !phone) return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin!" });
    
    const emailExist = users.find(u => u.email === email);
    const phoneExist = users.find(u => u.phone === phone);
    
    if (emailExist) return res.status(400).json({ error: "Email này đã được đăng ký sử dụng!" });
    if (phoneExist) return res.status(400).json({ error: "Số điện thoại này đã tồn tại trên hệ thống và chỉ được dùng 1 lần duy nhất!" });

    const newUser = { email, password, phone, role: "user", balance: 0, refBalance: 0, completedLinks: 0, bankInfo: "", refBy: refBy || null };
    users.push(newUser);
    res.json({ message: "Đăng ký thành công", user: newUser });
});

// 2. ĐĂNG NHẬP
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(400).json({ error: "Sai tài khoản hoặc mật khẩu rồi!" });
    res.json({ message: "OK", user });
});

// 3. TẢI DỮ LIỆU ĐỒNG BỘ
app.get('/api/user-data', (req, res) => {
    const user = users.find(u => u.email === req.query.email);
    if (!user) return res.status(404).json({ error: "Không thấy cơ sở dữ liệu user" });
    res.json({ email: user.email, phone: user.phone, balance: user.balance, refBalance: user.refBalance, completedLinks: user.completedLinks, bankInfo: user.bankInfo, notice: adminNotice });
});

// 4. KHÓA THÔNG TIN NGÂN HÀNG (KHÔNG CHO TỰ Ý SỬA)
app.post('/api/save-bank', (req, res) => {
    const { email, bankInfo } = req.body;
    const user = users.find(u => u.email === email);
    if (user && user.bankInfo === "") { // Chỉ cho lưu nếu đang trống
        user.bankInfo = bankInfo;
        return res.json({ success: true });
    }
    res.status(400).json({ error: "Thông tin đã được khóa bảo mật. Hãy báo Admin nếu muốn đổi!" });
});

// 5. HIỂN THỊ LINK
app.get('/api/links', (req, res) => res.json(links));

// 6. CHECK MÃ VƯỢT LINK (NẾU ĐÚNG MÃ ADMIN GÁN MỚI ĐƯỢC CỘNG TIỀN + 3% REF)
app.post('/api/verify-link', (req, res) => {
    const { email, linkId, code } = req.body;
    const user = users.find(u => u.email === email);
    const link = links.find(l => l.id === linkId);

    if (!link) return res.status(404).json({ error: "Không tồn tại link này!" });
    if (link.code !== code.trim()) return res.status(400).json({ error: "Mã xác thực sai rồi! Vui lòng vượt lại link để lấy đúng mã." });

    user.balance += link.price;
    user.completedLinks += 1;

    // Tự động phân chia 3% hoa hồng cho người giới thiệu nếu có
    if (user.refBy) {
        const referrer = users.find(u => u.email === user.refBy);
        if (referrer) {
            referrer.refBalance += (link.price * 0.03);
            referrer.balance += (link.price * 0.03);
        }
    }
    res.json({ success: true });
});

// 7. YÊU CẦU RÚT TIỀN (MIN RÚT 5.000Đ)
app.post('/api/withdraw', (req, res) => {
    const { email, amount } = req.body;
    const user = users.find(u => u.email === email);
    if (amount < 5000) return res.status(400).json({ error: "Số tiền rút tối thiểu là 5,000đ!" });
    if (user.balance < amount) return res.status(400).json({ error: "Tài khoản của bạn không đủ số dư để thực hiện lệnh!" });

    user.balance -= amount;
    withdrawals.push({ id: "WD" + Math.floor(Math.random()*90000), email, amount, bankInfo: user.bankInfo || "Chưa thiết lập", status: "pheduyet" });
    res.json({ success: true });
});

app.get('/api/withdraw-history', (req, res) => {
    res.json(withdrawals.filter(w => w.email === req.query.email));
});

// 8. PHÒNG CHAT CHUNG CHẶN TIN NHẮN XẤU
app.get('/api/chat', (req, res) => res.json(chats));
app.post('/api/chat', (req, res) => {
    const { email, text } = req.body;
    const isBad = CENSOR_WORDS.some(w => text.toLowerCase().includes(w));
    if (isBad) return res.status(400).json({ error: "Tin nhắn bị hệ thống chặn vì chứa từ ngữ không văn minh!" });
    
    chats.push({ email, text });
    if(chats.length > 50) chats.shift(); // Giới hạn 50 câu chat gần nhất
    res.json({ success: true });
});

/* TOÀN QUYỀN ADMIN */
app.get('/api/admin/withdrawals', (req, res) => res.json(withdrawals.filter(w => w.status === 'pheduyet')));
app.post('/api/admin/withdraw-action', (req, res) => {
    const { id, status } = req.body; // 'tuchoi', 'pheduyet', 'hoanthanh'
    const item = withdrawals.find(w => w.id === id);
    if(item) {
        item.status = status;
        if(status === 'tuchoi') { // Trả lại tiền nếu bị từ chối
            const user = users.find(u => u.email === item.email);
            if(user) user.balance += item.amount;
        }
    }
    res.json({ success: true });
});
app.post('/api/admin/add-link', (req, res) => {
    const { title, url, code, price } = req.body;
    links.push({ id: String(links.length + 1), title, url, code, price: parseInt(price) });
    res.json({ success: true });
});
app.post('/api/admin/notice', (req, res) => {
    adminNotice = req.body.text;
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hệ thống đang chạy trên cổng ${PORT}`));
