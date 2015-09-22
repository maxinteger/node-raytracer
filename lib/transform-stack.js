var glm = require('gl-matrix');

module.exports = Object.assign(Object.create(null), {
    stack: [],
    push (mat) {
        if (!mat){
            mat = glm.mat4.clone(this.top());
        }
        this.stack.push(mat);
        return mat;
    },

    pop (){
        if (this.stack.length !== 0){
            return this.stack.pop();
        } else {
            throw new Error('The stack is empty');
        }
    },

    top(){
        return this.stack[this.stack.length-1];
    }
}, ['mul', 'translate', 'scale', 'rotate'].reduce((stack, fn) => {
    stack[fn] = function(){
        var args = [new Float32Array(16), this.pop()].concat(arguments);
        return this.push(glm.mat4[fn].apply(null, args));
    };
    return stack;
}, {}));