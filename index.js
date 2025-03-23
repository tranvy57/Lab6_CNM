const express = require('express');
const app = express();

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

const docClient = new AWS.DynamoDB.DocumentClient();

const tableName = 'zytable'

const multer = require('multer');

const upload = multer()

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


app.post('/', upload.fields([]), (req, res) => {
    const { ma_sp, ten_sp, so_luong } = req.body;

    const params = {
        TableName: tableName,
        Item: {
            "ma_sp": ma_sp,
            "ten_sp": ten_sp,
            "so_luong": so_luong
        }
    };

    docClient.put(params, (err, data) => {
        if (err) {

            return res.send(params);

        } else {
            return res.redirect("/");
        }
    });
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