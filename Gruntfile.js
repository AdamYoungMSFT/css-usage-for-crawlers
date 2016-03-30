module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
        src: {
            src: [
              'src/cssParser.js',
              'src/cssUsageResults.js',
              'src/cssUsage.js',
            ],
            dest: 'cssUsage.src.js'
        }
    },
    babel: {
        options: {
            compact: true,
            comments: false,
            sourceMap: false,
            presets: ['es2015']
        },
        dist: {
            files: {
                'cssUsage.min.js': ['cssUsage.src.js']
            }
        }
    },
    uglify: {
      dist: {
        files: {
          'cssUsage.min.js': ['cssUsage.min.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-babel');
  grunt.registerTask('default', ['concat:src','babel:dist','uglify:dist']);
};