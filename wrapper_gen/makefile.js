function ParseFiles(){
     //node js modules
    var fs = require('fs'),
        PEG = require('pegjs');
    //_________________________________________________
    
    //parcer for idl files
    var parser = PEG.buildParser(fs.readFileSync('./lib/grammar.peg', 'utf8'));
    
    
    var idlparser;
    
    this.options = {
        idlExtension: '.idl',
        jsExtension: '.js',
        jsParcerFolder: './node_modules/',
        idlFolder: 'idlFolder/',
        jsStubsFolder: 'output/jsStubs/',
        pytonPath: 'Ti/Tizen/Ti.Tizen/'
        
    };
    
    this.init = function(){
        var self = this;
        var code = parser.toSource();
        
        //create js parcer
        fs.writeFile(this.options.jsParcerFolder + 'WebIDLParser.js', 'exports.Parser = ' + code, 
        
        //callback when js parcer is ready
        function(){
            fs.mkdirSync('output', 0755);
			fs.mkdirSync('output/jsStubs', 0755);
            //when js parser created we can use this modul
            idlparser = require(self.options.jsParcerFolder + 'WebIDLParser');  
            
            //create all js stubs
            self.createAllStubs(self.options.idlFolder);
        });
    };
    //create all stubs from folder
    var ti = require('./TitaniumInterface');
    
    this.createAllStubs = function(folder){
        var idlFiles = fs.readdirSync(folder);
        
        if(idlFiles.length > 0) {
            for(var i = 0, len = idlFiles.length; i<len; i++ ) {
                var name = idlFiles[i].replace(this.options.idlExtension, '');
                
                try {
                    this.createStub(name);
                } catch(err) {
                    console.log('Something wrong with ' +idlFiles[i] + '-->' + err);
                } 
            }
            fs.writeFileSync(this.options.jsStubsFolder + 'path.txt', ti.TitaniumInterface.pathes.get());
            
            fs.writeFileSync(this.options.jsStubsFolder + 'methods.txt', ti.TitaniumInterface.methods);
        } else {
            console.log('Folder with .idl files is empty');
        }
    };
    //create one file
    this.createStub = function(name){
        var idltext = fs.readFileSync(this.options.idlFolder + name + this.options.idlExtension, 'utf8');
        var realObject = idlparser.Parser.parse(idltext);
        fs.writeFileSync(this.options.jsStubsFolder + name.replace(/\s/g,'') + '.js', ti.TitaniumInterface.init(realObject));
        ti.TitaniumInterface.pathes.add(this.options.pytonPath + name.replace(/\s/g,''));
    };
}

var parseFiles = new ParseFiles();
parseFiles.init();