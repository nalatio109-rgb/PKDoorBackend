const express = require("express");
console.log("Bắt đầu chạy server...");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình lưu trữ cho multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
// Phục vụ ảnh tĩnh từ thư mục uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose.connect("mongodb+srv://nna710976_db_user:J0fCzf634eTrFIoS@pkdoor.hios0gx.mongodb.net/webmoi?retryWrites=true&w=majority")
    .then(() => console.log(" ✅ Kết nối MongoDB thành công"))
    .catch(err => console.log(err));

const ProductSchema = new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    image: String, // Ảnh chính
    images: [String], // Danh sách ảnh phụ/gallery
    features: String,
    specs: String,
    stock: { type: Number, default: 10 }, // Mặc định là 10 nếu không nhập
});

const Product = mongoose.model("Product", ProductSchema);

// Order Schema
const OrderSchema = new mongoose.Schema({
    customerInfo: {
        name: String,
        phone: String,
        address: String,
        note: String
    },
    items: [{
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String
    }],
    totalAmount: Number,
    status: { type: String, default: "Chờ xác nhận" }, // Chờ xác nhận, Đã xác nhận, Đang giao, Hoàn thành, Đã hủy
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model("Order", OrderSchema);

// Route upload ảnh
app.post("/upload", upload.single("image"), (req, res) => {
    console.log("Nhận yêu cầu upload...");
    if (!req.file) {
        return res.status(400).json({ message: "Không có file được tải lên" });
    }
    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    console.log("Upload thành công:", imageUrl);
    res.json({ imageUrl });
});

// Route upload nhiều ảnh
app.post("/upload-multiple", upload.array("images", 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "Không có file nào được tải lên" });
    }
    const imageUrls = req.files.map(file => `${req.protocol}://${req.get("host")}/uploads/${file.filename}`);
    res.json({ imageUrls });
});

app.get("/diag", (req, res) => {
    const uploadPath = path.join(__dirname, "uploads");
    res.json({
        __dirname,
        uploadPath,
        exists: fs.existsSync(uploadPath),
        files: fs.existsSync(uploadPath) ? fs.readdirSync(uploadPath) : []
    });
});

// thêm sản phẩm
app.post("/products", async (req, res) => {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.json(newProduct);
});

// lấy danh sách sản phẩm
app.get("/products", async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

// lấy chi tiết 1 sản phẩm
app.get("/products/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: "Không tìm thấy sản phẩm" });
        }
    } catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
});

app.delete("/products/:id", async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Đã xoá" });
});

app.put("/products/:id", async (req, res) => {
    const updated = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
    );
    res.json(updated);
});

// --- ORDER ROUTES ---

// Tạo đơn hàng mới
app.post("/orders", async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();

        // Tự động trừ kho cho từng sản phẩm
        for (const item of req.body.items) {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity }
            });
        }

        res.status(201).json(newOrder);
    } catch (err) {
        res.status(400).json({ message: "Lỗi tạo đơn hàng", error: err });
    }
});

// Lấy danh sách đơn hàng
app.get("/orders", async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải đơn hàng" });
    }
});

// Cập nhật trạng thái đơn hàng
app.put("/orders/:id", async (req, res) => {
    try {
        const updated = await Order.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: "Lỗi cập nhật đơn hàng" });
    }
});

// Xóa đơn hàng
app.delete("/orders/:id", async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ message: "Đã xóa đơn hàng" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi xóa đơn hàng" });
    }
});

// --- CONTACT ROUTES ---

const ContactSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    category: String,
    message: String,
    status: { type: String, default: "Chưa đọc" }, // Chưa đọc, Đã liên hệ, Đã hoàn thành
    createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model("Contact", ContactSchema);

// Gửi tin nhắn liên hệ mới
app.post("/contacts", async (req, res) => {
    try {
        const newContact = new Contact(req.body);
        await newContact.save();
        res.status(201).json(newContact);
    } catch (err) {
        res.status(400).json({ message: "Lỗi gửi tin nhắn", error: err });
    }
});

// Lấy danh sách tin nhắn liên hệ
app.get("/contacts", async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải tin nhắn" });
    }
});

// Cập nhật trạng thái tin nhắn
app.put("/contacts/:id", async (req, res) => {
    try {
        const updated = await Contact.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: "Lỗi cập nhật trạng thái" });
    }
});

// Xóa tin nhắn
app.delete("/contacts/:id", async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.json({ message: "Đã xóa tin nhắn" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi xóa tin nhắn" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});