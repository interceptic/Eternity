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

function handleTaxClaim(profit) {
    if (profit < 1000000) return profit; // under 1 mil no 1% tax?
    return profit * .99;
}

module.exports = { handleTaxList, handleTaxClaim }