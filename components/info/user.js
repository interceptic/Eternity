const axios = require('axios');

async function userInfo(username) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            const { id, name } = response.data;
            resolve({ id, name });
            } catch (error) {
                reject(error);
            }
        });
}

module.exports = { userInfo };