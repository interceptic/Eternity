function handleTaxList(price, target) {
    let profit = 0
    // 1% tax included
    if(target < 10000000) { // 10 million
        profit = (target) * 0.98
    } else if (target < 100000000) { // 100 million
        profit = (target) * 0.97
    }
    else { // over
        profit = (target) * 0.965
    }
    return (profit - price);
}

function listWithoutTarget(price) {
    if(price < 10000000) { // 10 million
        price  *= 0.98
    } else if (price < 100000000) { // 100 million
        price *= 0.97
    }
    else { // over
        price *= 0.965
    }
    return price;
}

function handleTaxClaim(profit) {
    if (profit < 1000000) return profit; // under 1 mil no 1% tax?
    return profit * .98;
}

module.exports = { handleTaxList, handleTaxClaim, listWithoutTarget}