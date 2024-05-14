const { FadeCalculator } = require('csgo-fade-percentage-calculator');
export default function getFadePercentage(weaponType, skinName, paintSeed) {
    if(skinName == "Fade") {
        //Fade
        const supportedWeapons = FadeCalculator.getSupportedWeapons();
        if(supportedWeapons.includes(weaponType)) {
            const { percentage } = FadeCalculator.getFadePercentage(weaponType, paintSeed);
            return `${Math.round(percentage * 10) / 10}%`;
        }
    }
    return null;
}