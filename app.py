from flask import Flask, render_template, send_from_directory

app = Flask(__name__, static_folder='static', static_url_path='')


@app.route('/favicon.ico')
def favicon():
    return send_from_directory(app.static_folder, 'images/favicon.ico')


@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run()
