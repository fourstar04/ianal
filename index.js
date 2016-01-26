#!/usr/bin/env node

var fs = require('fs'),
  json2md = require('json2md');

var licenseRegex = [
  
  // Some defaults with non-capturing groups (?:)
  { name: 'MIT', regex: /(?:The )?MIT(?: (L|l)icense)/ },
  { name: 'BSD', regex: /(?:The )?BSD(?: (L|l)icense)/ },
  { name: 'ISC', regex: /(?:The )?ISC(?: (L|l)icense)/ },
  
  // This will attempt to capture the name and display it
  { name: false, regex: /(?:The )?([\w-/\.]{3,}?) (L|l)icense/ }
];

var nodeConfig = {
  file: 'package.json',
  path: 'node_modules',
  description: 'node modules'
};

var bowerConfig = {
  file: 'bower.json',
  path: 'bower_components',
  description: 'bower components'
};

// Root project to analize
var root = process.cwd();

var getLicenseInfo = function(config, callback) {
  // Open a specific file from a project
  function open(mod, file, req){
    var path = root + '/' + config.path + '/' + mod + '/' + file;
    return fs.existsSync(path) && (req ? require(path) : fs.readFileSync(path, 'utf8'));
  }

  // Default fields so the '?...' pop up first
  var deff = {
    package: { '?none': [], '?verify': [] },
    file: { '?none': [], '?verify': [] },
    readme: { '?none': [], '?verify': [] },
    total: { '?none': [], '?invalid': [], '?multiple': [] },
    modules: {}
  };

  if (!fs.existsSync(root + '/' + config.path)){
    callback('No ' + config.description + ' installed', null);
  } else 
  callback(null, fs.readdirSync(root + '/' + config.path).reduce(function(all, name){
    var mod = {};
    
    // Invalid module (such as .bin)
    if (/^\./.test(name)) return all;
    
    // PACKAGE.JSON
    var pack = open(name, config.file, true);
    var license = !pack ? '?none' : pack.license || pack.licenses || '?none';
    license = Array.isArray(license) && license.length > 1 ? '?multiple' : license;
    license = typeof license === 'string' ? license : license.type ||  '?verify';
    mod.package = license;
    
    
    // LICENSE (file)
    // Let's check it also with the file
    var file = open(name, 'LICENSE') || open(name, 'LICENSE.md')
      || open(name, 'License') || open(name, 'License.md')
      || open(name, 'license') || open(name, 'license.md');
    mod.file = (!file) ? '?none' : licenseRegex.filter(function(license){
      return license.regex.test(file);
    }).map(function(license){
      // Need this double check in case only 'other' is matched, then extract it
      return license.name || file.match(license.regex)[1];
    }).shift() || '?verify';
    
    // README
    var readme = open(name, 'README') || open(name, 'README.md')
       || open(name, 'Readme') || open(name, 'Readme.md')
       || open(name, 'readme') || open(name, 'readme.md');
    mod.readme = (!file) ? '?none' : licenseRegex.filter(function(license){
      return license.regex.test(file);
    }).map(function(license){
      return license.name || file.match(license.regex)[1];
    }).shift() || '?verify';
    
    all.package[mod.package] = [name].concat(all && all.package[mod.package] || []);
    all.file[mod.file] = [name].concat(all && all.file[mod.file] || []);
    all.readme[mod.readme] = [name].concat(all && all.readme[mod.readme] || []);
    
    // TOTAL
    all.modules[name] = [mod.package, mod.file, mod.readme];
    check = [mod.package, mod.file, mod.readme].filter(function(lic){
      return lic && !/^\?none/.test(lic);
    });
    
    function hasMultiple(arr){
      return arr.filter(function(e, i){
        return !/\?/.test(e) && arr.indexOf(e) + 1 !== i;
      }) >= 2;
    }
    
    var total;
    if (!check || !check.length) {
      total = '?none';
    } else if (check.indexOf('?verify') !== -1) {
      total = '?verify';
    } else if (check.indexOf('?multiple') !== -1 || hasMultiple(check)) {
      total = '?multiple';
    } else {
      total = check.shift();
    }
    all.total[total] = [name].concat(all.total[total] || []);
    //console.log(name, check);
    
    return all;
  }, deff));
};

flattenKeysIntoArrayValues = function(array) {
  var newArray = [];
  for (var key in array) {
    var item = array[key];
    item.unshift(key);
    newArray.push(item);
  }
  return newArray;
};

getLicenseInfo(nodeConfig, function(err, nodeLicenseInfo){
  var nodeTable;
  if (!err) nodeTable = [{h1:'Node Modules'},{ table: { headers: ['Module', 'Package', 'License', 'Readme'], rows: flattenKeysIntoArrayValues(nodeLicenseInfo.modules) } }];

  getLicenseInfo(bowerConfig, function(err, bowerLicenseInfo){
    var bowerTable;
    if (!err) bowerTable = [{h1:'Bower Modules'},{ table: { headers: ['Module', 'Package', 'License', 'Readme'], rows: flattenKeysIntoArrayValues(bowerLicenseInfo.modules) } }];

    var reports = [];
    if (nodeTable) reports.push(nodeTable);
    if (bowerTable) reports.push(bowerTable);

    var markdown = json2md(reports);

    fs.writeFile('licenses.md', markdown, function(err) {
      if (err) throw err;
      console.log('It\'s saved!');
    });

  });
});