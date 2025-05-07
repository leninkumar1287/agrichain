const fileformatter = (bytes, decimal) => {
    if (bytes === 0) {
        return '0 Bytes';
    }
    let dm = decimal || 2;
    let sizes = ['Bytes', 'KB', 'MB','GB'];
    let index = Math.floor(Math.log(bytes) / Math.log(1000));
    return parseFloat((bytes / Math.pow(1000, index)).toFixed(dm)) + ' ' + sizes[index];
}

module.exports = {
    fileformatter
}
