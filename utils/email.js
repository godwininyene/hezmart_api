const nodemailer = require('nodemailer');
const pug = require('pug')

module.exports = class Email {
    constructor(user,  emailVerificationCode, url, type){
        this.email = user.email;
        this.userType = user.role;
        this.firstName = user.firstName;
        this.emailVerificationCode = emailVerificationCode;
        this.url=url;
        this.type = type;
        this.from = `Hezmart <${process.env.EMAIL_FROM}>`;
    }

    newTransport(){
        if(process.env.NODE_ENV === 'production'){
            // Using Gmail service
            return nodemailer.createTransport({
                service:"Gmail",
                auth:{
                    user:process.env.GMAIL_USERNAME,
                    pass:process.env.GMAIL_PASS
                }
            })
            // Using hosted smtp service
            // return nodemailer.createTransport({
            //     host: process.env.SMTP_EMAIL_HOST,
            //     port: process.env.SMTP_EMAIL_PORT,
            //     secure: process.env.SMTP_EMAIL_PORT == 465, // Use TLS for port 465
            //     auth: {
            //         user: process.env.SMTP_EMAIL_USER,
            //         pass: process.env.SMTP_EMAIL_PASSWORD
            //     }
            // });
        }

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
            url: this.url,
            type:this.type,
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
    async sendStatus(){
        await this.send('status', "Your Hezmart user account status");
    }
   
    async sendPasswordReset(){
        await this.send('passwordReset', 'Your password reset token (valid for only 15 minutes)')
    }
    async sendVerificationEmail(){
        await this.send('emailVerification', 'Your email verification code (Valid for 15 minutes)')
    }
}
