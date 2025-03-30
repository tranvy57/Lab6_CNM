const express = require('express');
const app = express();
const path = require('path')
const {v4: uuid} = require('uuid')

app.use(express.json({extended: false}));  
app.use(express.static('./views'))
app.set('view engine', 'ejs');
app.set('views', './views');

//config aws dynamo 
const AWS = require('aws-sdk');
const config = new AWS.Config({
    accessKeyId: '<>',
    secretAccessKey: '<>',
    region: 'ap-southeast-1'
})
AWS.config = config;
const s3 = new AWS.S3()

const docClient = new AWS.DynamoDB.DocumentClient();

const tableName = 'zytable'

const multer = require("multer");

const storage = multer.memoryStorage({
    destination(req, file, callback) {
        callback(null, "");
    },
});

function checkFileType(file, cb) {
    const fileTypes = /jpeg|jpg|png|gif/;

    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    }

    return cb("Error: Image Only");
}

const upload = multer({
    storage,
    limits: { fileSize: 2000000 }, // 2MB
    fileFilter(req, file, cb) {
        checkFileType(file, cb);
    },
});

app.get('/', (req, res) => {
    const params = {
        TableName: tableName
    }


    docClient.scan(params, (err, data) => {
        if(err){
            res.send('Internal Server Error')
        } else {
            return res.render('index', {sanPhams: data.Items})
        }
    })
});

const CLOUD_FRONT_URL = '<>';

app.post('/', upload.single('image'), (req, res) => {
    const { ma_sp, ten_sp, so_luong } = req.body;
    const image = req.file.originalname.split(".");

    const fileType = image[image.length-1];

    const filePath = `${uuid() + Date.now().toString()}.${fileType}`;

    const params = {
        Bucket: "zybuckett",
        Key: filePath,
        Body: req.file.buffer
    }

    s3.upload(params, (error, data) => {
        if(error){
            console.log("error=", error);
            return res.send("Internal Server Error");
        }else{
            const newItem = {
                TableName: tableName,
                Item: {
                    "ma_sp": ma_sp,
                    "ten_sp": ten_sp,
                    "so_luong": so_luong,
                    "image_url":`${CLOUD_FRONT_URL}/${filePath}`
                }
            };
            docClient.put(newItem, (err, data) => {
                if(err) {
                    res.send(err);
                } else {
                    res.redirect('/');
                }
            });
        }
    })    

    
});

app.post("/delete", upload.fields([]), async (req, res) => {
    const listItems = Object.keys(req.body);

    if (listItems.length === 0) {
        return res.redirect("/");
    }

    async function deleteItem(ma_sp) {
        const params = {
            TableName: tableName,
            Key: { "ma_sp": ma_sp }
        };

        return new Promise((resolve, reject) => {
            docClient.delete(params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    try {
        await Promise.all(listItems.map(deleteItem));
        res.redirect("/");
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});