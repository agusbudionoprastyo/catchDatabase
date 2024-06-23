const mariadb = require('mariadb');
const axios = require('axios');

// Definisikan variabel lastUpdateTime
let lastUpdateTime = new Date();

// Konfigurasi koneksi ke MariaDB
const pool = mariadb.createPool({
    host: 'localhost',
    user: 'dafamsem_ag',
    password: 'Ag7us777__',
    database: 'dafamsem_cantingfood',
    connectionLimit: 5
});

// Fungsi untuk melakukan polling perubahan dalam tabel order
async function pollChanges() {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(`
        SELECT orders.order_serial_no, orders.total, orders.total_tax,
        REPLACE(REPLACE(REPLACE(GROUP_CONCAT(CONCAT(items.name, " ", CASE WHEN JSON_LENGTH(item_variations) = 0 THEN '' ELSE CONCAT(" ", JSON_EXTRACT(item_variations, '$[*].name')) END, " ", order_items.quantity) SEPARATOR ',  '), '["', 'include '), '"]', ''), '"', '') AS item_names,
        dining_tables.name AS table_name
        FROM orders 
        INNER JOIN order_items ON orders.id = order_items.order_id 
        INNER JOIN dining_tables ON orders.dining_table_id = dining_tables.id 
        INNER JOIN items ON order_items.item_id = items.id
        WHERE orders.updated_at > ? AND orders.status = 1
        GROUP BY orders.order_serial_no;`
        , [lastUpdateTime]);
        if (rows.length > 0) {
            sendRequests(rows); // Kirim permintaan HTTP ke endpoint untuk setiap perubahan
            lastUpdateTime = new Date(); // Update lastUpdateTime
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (conn) return conn.end();
    }
}

// // Function to format the subtotal
// function formatCurrency(amount) {
//     return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount).replace('Rp', 'Rp');
// }

// // Fungsi untuk mengirim permintaan HTTP ke endpoint Google Apps Script
// async function sendRequests(rows) {
//     for (let row of rows) {
//         const orderId = row.order_serial_no;
//         const total = row.total;
//         const itemName = row.item_names;
//         const tableName = row.table_name;
//         const url = 'https://script.google.com/macros/s/AKfycbw64k_yf7G5ulFmGDibuich1VAniOHlrbMaJ2wExOzF9sAfworaBaUnI9_gsySGDtzH/exec'; // Ganti dengan URL endpoint Google Apps Script Anda
//         const payload = { orderId, total, itemName, tableName };
//         try {
//             await axios.post(url, payload);
//             console.log('Permintaan terkirim:', payload);
//         } catch (error) {
//             console.error('Error mengirim permintaan:', error);
//         }
//     }
// }

// Function to format the subtotal
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount).replace('Rp', 'Rp');
}

// Fungsi untuk mengirim permintaan HTTP ke endpoint
async function sendRequests(rows) {
    for (let row of rows) {
        const orderId = row.order_serial_no;
        const total = row.total;
        const tax = row.total_tax
        const itemName = row.item_names;
        const tableName = row.table_name;
        const subtotalCurency = formatCurrency(total);
        const taxNserviceCurency = formatCurrency(tax);
        const totalCurency = formatCurrency(parseFloat(total) + parseFloat(tax));
        const url = 'https://wagateway.dafamsemarang.my.id/send-group-message'; // URL baru
        const message = `*Hai canting, ada pesanan baru nih! Nomor Pesanan ${orderId}, Room/Table ${tableName}*\n\n_Item_\n${itemName}\n\n_Subtotal_\n${subtotalCurency}\n\n_Tax & Service_ 21%\n${taxNserviceCurency}\n\n_Total_\n${totalCurency}\n\n_klik tautan berikut untuk mengkonfirmasi pesanan_\nhttps://cantingfood.my.id\n_Thankyou & happy working_`;
        const payload = { message, id_group: '120363304142052316@g.us' }; // Sesuaikan id_group

        try {
            await axios.post(url, new URLSearchParams(payload), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            console.log('Permintaan terkirim:', payload);
        } catch (error) {
            console.error('Error mengirim permintaan:', error);
        }
    }
}

// Fungsi untuk menguji endpoint setiap 1 jam
async function testEndpoint() {
    const url = 'https://wagateway.dafamsemarang.my.id/send-group-message'; // URL yang sama dengan yang digunakan di sendRequests
    const payload = { message: 'API status : running', id_group: '120363304142052316@g.us' }; // Sesuaikan id_group

    try {
        await axios.post(url, new URLSearchParams(payload), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('Test endpoint berhasil:', payload);
    } catch (error) {
        console.error('Error menguji endpoint:', error);
    }
}

// Set interval untuk menguji endpoint setiap 1 jam (3600000 ms)
setInterval(testEndpoint, 3600000);

// Set interval untuk memanggil polling perubahan setiap 5 detik
setInterval(pollChanges, 5000);