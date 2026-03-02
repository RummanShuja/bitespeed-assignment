import dotenv from 'dotenv'
import express from 'express'
import mysql from 'mysql2/promise'

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
let db;

try {
    db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
    });
    console.log("Connected to Database");
} catch (err) {
    console.log("DB connection failed: ", err);
}



app.post('/identify', async (req, res) => {
    try {

        const { email, phoneNumber } = req.body;
        console.log("email= ", email, " phoneNumber= ", phoneNumber);
        if (!email && !phoneNumber) {
            return res.status(400).json({ success: false, message: "Either email or phoneNumber must be provided" });
        }

        let [rows] = await db.execute(`
            SELECT *
            FROM Contact 
            WHERE email=? OR phoneNumber=? ;    
        `, [email || null, phoneNumber || null]);


        if (rows.length === 0) {
            // There are no existing contact against an incoming request
            const [result] = await db.execute(`
            INSERT INTO Contact (email, phoneNumber,linkPrecedence) VALUES
            (?,?,'primary')
            `, [email || null, phoneNumber || null]);

            const newContactId = result.insertId;
            const response = {
                "contact": {
                    "primaryContactId": newContactId,
                    "emails": email ? [email] : [],
                    "phoneNumbers": phoneNumber ? [phoneNumber] : [],
                    "secondaryContactIds": []
                }
            }
            return res.status(201).json(response);
        }


        const rootIdSets = new Set();
        for (let row of rows) {
            if (row.linkPrecedence === 'primary') {
                rootIdSets.add(row.id);
            } else {
                rootIdSets.add(row.linkedId);
            }
        }
        if (rootIdSets.size > 1) {
            const rootIds = [...rootIdSets];
            const placeholders = rootIds.map(() => '?').join(',');

            const [primaryRows] = await db.execute(`
                SELECT * FROM Contact
                WHERE id IN (${placeholders})`, rootIds);

            primaryRows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const mainPrimary = primaryRows[0];

            // update db primary->secondary
            for (let i = 1; i < primaryRows.length; i++) {
                const secondaryPrimary = primaryRows[i];

                await db.execute(`
                UPDATE Contact
                SET linkPrecedence = 'secondary', linkedId= ?
                WHERE id = ?`, [mainPrimary.id, secondaryPrimary.id]);
                // Updating the linkedId of secondaries to correct primary Id 
                await db.execute(`
                UPDATE Contact
                SET linkedId=?
                WHERE linkedId=?`, [mainPrimary.id, secondaryPrimary.id]);
            }

            const [updatedRows] = await db.execute(`
            SELECT * FROM Contact
            WHERE email=? OR phoneNumber=?`, [email || null, phoneNumber || null]);

            rows.length = 0;
            rows.push(...updatedRows);
        }

        const emailSet = new Set();
        const phoneNumberSet = new Set();
        const secondaryContactIdsSet = new Set();
        let primaryContactId;
        let primaryEmail;
        let primaryPhoneNumber;

        for (let row of rows) {
            if (row.linkPrecedence === 'primary') {
                primaryContactId = row.id;

                if (row.email) {
                    primaryEmail = row.email;
                    emailSet.add(row.email);
                }
                if (row.phoneNumber) {
                    primaryPhoneNumber = row.phoneNumber;
                    phoneNumberSet.add(row.phoneNumber);
                }
            }
            else {
                primaryContactId = row.linkedId;
                if (row.email) {
                    emailSet.add(row.email);
                }
                if (row.phoneNumber) {
                    phoneNumberSet.add(row.phoneNumber);
                }
                if (row.id) secondaryContactIdsSet.add(row.id);
            }
        }

        const [linkedRows] = await db.execute(`
            SELECT * FROM Contact
            WHERE id = ? OR linkedId = ?;
            `, [primaryContactId || null, primaryContactId || null]);

        for (let row of linkedRows) {
            if (row.linkPrecedence == 'primary') {
                if (row.email) {
                    primaryEmail = row.email;
                    emailSet.add(row.email);
                }
                if (row.phoneNumber) {
                    primaryPhoneNumber = row.phoneNumber;
                    phoneNumberSet.add(row.phoneNumber);
                }
            }
            else {
                if (row.email) emailSet.add(row.email);
                if (row.phoneNumber) phoneNumberSet.add(row.phoneNumber);
                if (row.id) secondaryContactIdsSet.add(row.id);
            }

        }

        let secondaryContactIds = [...secondaryContactIdsSet];
        let emails = [...emailSet];

        if (primaryEmail) {
            emails = emails.filter((item) => item != primaryEmail);
            emails.unshift(primaryEmail);
        }
        let phoneNumbers = [...phoneNumberSet];
        if (primaryPhoneNumber) {
            phoneNumbers = phoneNumbers.filter((number) => number != primaryPhoneNumber);
            phoneNumbers.unshift(primaryPhoneNumber);
        }


        // an incoming request has either of phoneNumber or email common to an existing
        // contact but contains new information
        const emailExists = linkedRows.some((row) => row.email === email);
        const phoneNumberExists = linkedRows.some((row) => row.phoneNumber === phoneNumber);

        if ((email && !emailExists) || (phoneNumber && !phoneNumberExists)) {

            const [result] = await db.execute(`
                INSERT INTO Contact (email, phoneNumber,linkedId, linkPrecedence) VALUES
                (?,?,?,'secondary');
                `, [email, phoneNumber, primaryContactId]);
            const newContactId = result.insertId;

            if (phoneNumber && !phoneNumberExists) {
                phoneNumbers.push(phoneNumber);
            }
            if (email && !emailExists) {
                emails.push(email);
            }

            secondaryContactIds.push(newContactId);

            const response = {
                "contact": {
                    "primaryContactId": primaryContactId,
                    "emails": emails,
                    "phoneNumbers": phoneNumbers,
                    "secondaryContactIds": secondaryContactIds
                }
            }
            return res.status(201).json(response);
        }

        const response = {
            "contact": {
                "primaryContactId": primaryContactId,
                "emails": emails,
                "phoneNumbers": phoneNumbers,
                "secondaryContactIds": secondaryContactIds
            }
        }

        res.status(200).json(response);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
})

app.get('/', (req, res) => {
    res.send("Api working");
})

app.listen(PORT, () => {
    console.log(`Server is listening to port: ${PORT}`);
})