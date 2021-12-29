import {v4 as uuidv4} from "uuid";

function GetUUID() {
    let token = localStorage.getItem('token');
    if (!token) {
        token = uuidv4();
        localStorage.setItem('token', token)
    }
    return token;
}

export default GetUUID