const nodemailer = require('nodemailer');
const pug = require('pug')

module.exports = class Email {
    constructor(user,  emailVerificationCode){
        this.email = user.email;
        this.userType = user.role;
        this.firstName = user.firstName;
        this.emailVerificationCode = emailVerificationCode;
        this.from = `Hezmart <${process.env.EMAIL_FROM}>`;
    }

    newTransport(){
        // if(process.env.NODE_ENV === 'production'){
        //     // Using hosted smtp service
        //     return nodemailer.createTransport({
        //         host: process.env.SMTP_EMAIL_HOST,
        //         port: process.env.SMTP_EMAIL_PORT,
        //         secure: process.env.SMTP_EMAIL_PORT == 465, // Use TLS for port 465
        //         auth: {
        //             user: process.env.SMTP_EMAIL_USER,
        //             pass: process.env.SMTP_EMAIL_PASSWORD
        //         }
        //     });
        // }

        return nodemailer.createTransport({
            host:process.env.EMAIL_HOST,
            port:process.env.EMAIL_PORT,
            auth:{
                user:process.env.EMAIL_USERNAME,
                pass:process.env.EMAIL_PASSWORD
            }
        })
    }

    async send(template, subject){
        // 1) Render the HTML base on the pug template
        const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`,{
            firstName:this.firstName,
            userType:this.userType,
            emailVerificationCode:this.emailVerificationCode,
            subject
        })
        //2) Define email options
        const mailOptions = {
            from:this.from,
            to:this.email,
            subject,
            html
        }
        // 3) Create a transport and send email
       await this.newTransport().sendMail(mailOptions)
    }

    async sendOnBoard(){
        await this.send("welcome", "Welcome to the family")
    }
   
    async sendPasswordReset(){
        await this.send('passwordReset', 'Your password reset token (valid for only 10 minutes)')
    }
    async sendVerificationEmail(){
        await this.send('emailVerification', 'Your email verification code (Valid for 15 minutes)')
    }
}
