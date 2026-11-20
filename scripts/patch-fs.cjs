const fs = require('fs');
if (fs.realpath && fs.realpath.native) {
  fs.realpath.native = fs.realpath;
}
if (fs.realpathSync && fs.realpathSync.native) {
  fs.realpathSync.native = fs.realpathSync;
}
